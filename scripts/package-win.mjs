import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const rootDir = process.cwd();
const resourcesDir = path.join(rootDir, 'resources');
const iconPath = path.join(resourcesDir, 'icon.ico');
const electronDistDir = path.join(rootDir, 'node_modules', 'electron', 'dist');
const releaseDir = path.join(rootDir, 'release', 'Aether Music');
const releaseAppDir = path.join(releaseDir, 'resources', 'app');
const releaseBinDir = path.join(releaseDir, 'resources', 'bin');

function renderIconPixelsBgra(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const corner = size * 0.22;

  for (let y = 0; y < size; y++) {
    // Bottom-up row order for BMP DIB inside .ico
    const srcY = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(srcY - cy);
      const boxDx = Math.max(dx - (cx - corner), 0);
      const boxDy = Math.max(dy - (cy - corner), 0);

      if (boxDx * boxDx + boxDy * boxDy > corner * corner) {
        buf[idx + 3] = 0;
        continue;
      }

      const dist = Math.hypot(x - cx, srcY - cy) / size;
      const t = (x + srcY) / (size * 2);

      let red = Math.round(16 + t * 26);
      let green = Math.round(18 + t * 20);
      let blue = Math.round(40 + t * 52);

      // Luminous violet-to-cyan vinyl ring
      if (dist > 0.27 && dist < 0.35) {
        red = Math.round(112 + t * 90);
        green = Math.round(140 + (1 - t) * 90);
        blue = 255;
      }

      // Three crisp center waveform bars
      const nx = x / size;
      const ny = srcY / size;
      const barW = 0.036;
      const inBar1 = Math.abs(nx - 0.36) <= barW && Math.abs(ny - 0.5) <= 0.13;
      const inBar2 = Math.abs(nx - 0.5) <= barW && Math.abs(ny - 0.5) <= 0.22;
      const inBar3 = Math.abs(nx - 0.64) <= barW && Math.abs(ny - 0.5) <= 0.16;

      if (inBar1 || inBar2 || inBar3) {
        red = 246;
        green = 250;
        blue = 255;
      }

      buf[idx] = blue;
      buf[idx + 1] = green;
      buf[idx + 2] = red;
      buf[idx + 3] = 255;
    }
  }

  return buf;
}

function encodeDibFrame(size) {
  const pixels = renderIconPixelsBgra(size);
  const andRowBytes = Math.ceil(size / 32) * 4;
  const andMask = Buffer.alloc(andRowBytes * size);

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight (color + AND mask)
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // BI_RGB
  header.writeUInt32LE(pixels.length + andMask.length, 20);

  return Buffer.concat([header, pixels, andMask]);
}

function buildMultiResIco(targetPath) {
  const sizes = [16, 32, 48, 64, 128];
  const frames = sizes.map((s) => ({ size: s, data: encodeDibFrame(s) }));

  const dirHeader = Buffer.alloc(6);
  dirHeader.writeUInt16LE(0, 0); // Reserved
  dirHeader.writeUInt16LE(1, 2); // Icon type
  dirHeader.writeUInt16LE(frames.length, 4);

  const entrySize = 16;
  let offset = dirHeader.length + entrySize * frames.length;
  const entries = frames.map((frame) => {
    const entry = Buffer.alloc(entrySize);
    entry[0] = frame.size >= 256 ? 0 : frame.size;
    entry[1] = frame.size >= 256 ? 0 : frame.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(frame.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += frame.data.length;
    return entry;
  });

  const icoBuffer = Buffer.concat([
    dirHeader,
    ...entries,
    ...frames.map((f) => f.data),
  ]);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, icoBuffer);
}

function copyFileSafe(srcPath, destPath) {
  try {
    fs.copyFileSync(srcPath, destPath);
  } catch (err) {
    const code = err && typeof err === 'object' ? err.code : '';
    const errno = err && typeof err === 'object' ? err.errno : 0;
    if (
      (code === 'EBUSY' ||
        code === 'EPERM' ||
        code === 'EACCES' ||
        code === 'UNKNOWN' ||
        errno === -4094) &&
      fs.existsSync(destPath) &&
      fs.statSync(destPath).size > 0
    ) {
      console.log(`  [skip locked] ${path.basename(destPath)} (app currently running)`);
      return;
    }
    throw err;
  }
}

function copyDirOverwrite(srcDir, destDir, skipRelPaths = new Set(), baseRel = '') {
  fs.mkdirSync(destDir, { recursive: true });
  for (const item of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const rel = baseRel ? `${baseRel}/${item.name}` : item.name;
    if (skipRelPaths.has(rel)) continue;
    const srcPath = path.join(srcDir, item.name);
    const destPath = path.join(destDir, item.name);
    if (item.isDirectory()) {
      copyDirOverwrite(srcPath, destPath, skipRelPaths, rel);
    } else {
      copyFileSafe(srcPath, destPath);
    }
  }
}

function main() {
  if (!fs.existsSync(electronDistDir)) {
    throw new Error(`Missing Electron runtime at ${electronDistDir}`);
  }

  console.log('[1/5] Generating multi-resolution Aether Music icon...');
  buildMultiResIco(iconPath);

  console.log('[2/5] Copying Electron runtime to release/Aether Music...');
  const skipSet = new Set(['electron.exe', 'resources/default_app.asar']);
  copyDirOverwrite(electronDistDir, releaseDir, skipSet);
  copyFileSafe(
    path.join(electronDistDir, 'electron.exe'),
    path.join(releaseDir, 'Aether Music.exe')
  );

  console.log('[3/5] Bundling application code & assets into resources/app...');
  fs.mkdirSync(releaseAppDir, { recursive: true });
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const packagedManifest = {
    name: rootPkg.name || 'aether-music',
    productName: 'Aether Music',
    version: rootPkg.version || '1.0.0',
    description: rootPkg.description || 'Aether Music',
    main: 'dist-electron/main.cjs',
    author: rootPkg.author || 'Aether Studio',
    license: rootPkg.license || 'MIT',
  };
  fs.writeFileSync(
    path.join(releaseAppDir, 'package.json'),
    JSON.stringify(packagedManifest, null, 2),
    'utf8'
  );
  fs.cpSync(path.join(rootDir, 'dist'), path.join(releaseAppDir, 'dist'), {
    recursive: true,
    force: true,
  });
  fs.cpSync(path.join(rootDir, 'dist-electron'), path.join(releaseAppDir, 'dist-electron'), {
    recursive: true,
    force: true,
  });
  copyFileSafe(iconPath, path.join(releaseDir, 'resources', 'icon.ico'));

  console.log('[4/5] Copying bundled yt-dlp.exe & ffmpeg.exe...');
  fs.mkdirSync(releaseBinDir, { recursive: true });
  const srcYtDlp = path.join(resourcesDir, 'bin', 'yt-dlp.exe');
  if (fs.existsSync(srcYtDlp)) {
    copyFileSafe(srcYtDlp, path.join(releaseBinDir, 'yt-dlp.exe'));
  }
  const srcFfmpeg = path.join(rootDir, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  if (fs.existsSync(srcFfmpeg)) {
    copyFileSafe(srcFfmpeg, path.join(releaseBinDir, 'ffmpeg.exe'));
  }

  console.log('[5/5] Compiling native Win32 Job-Object launcher Aether Music.exe...');
  const cscExe = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
  if (!fs.existsSync(cscExe)) {
    throw new Error(`.NET compiler not found at ${cscExe}`);
  }
  const launcherCs = path.join(rootDir, 'scripts', 'AetherLauncher.cs');
  const rootLauncherExe = path.join(rootDir, 'Aether Music.exe');
  try {
    execFileSync(
      cscExe,
      [
        '/nologo',
        '/optimize+',
        '/target:winexe',
        `/win32icon:${iconPath}`,
        `/out:${rootLauncherExe}`,
        launcherCs,
      ],
      { stdio: 'inherit' }
    );
  } catch (err) {
    if (fs.existsSync(rootLauncherExe)) {
      console.log('  [skip locked] Aether Music.exe launcher already exists and is running.');
    } else {
      throw err;
    }
  }

  console.log('');
  console.log('Package ready:');
  console.log(`  Launcher EXE : ${rootLauncherExe}`);
  console.log(`  Portable App : ${path.join(releaseDir, 'Aether Music.exe')}`);
}

main();
