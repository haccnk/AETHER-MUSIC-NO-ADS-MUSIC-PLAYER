using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace AetherMusicLauncher
{
    internal static class Program
    {
        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
        private const int JobObjectExtendedLimitInformation = 9;

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public IntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetInformationJobObject(
            IntPtr hJob,
            int infoType,
            IntPtr lpJobObjectInfo,
            uint cbJobObjectInfoLength
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr hObject);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

        private static string QuoteArgs(string[] args)
        {
            if (args == null || args.Length == 0) return string.Empty;
            var sb = new StringBuilder();
            for (int i = 0; i < args.Length; i++)
            {
                if (i > 0) sb.Append(' ');
                string arg = args[i] ?? string.Empty;
                if (arg.Length == 0 || arg.IndexOfAny(new[] { ' ', '\t', '"' }) >= 0)
                {
                    sb.Append('"');
                    sb.Append(arg.Replace("\"", "\\\""));
                    sb.Append('"');
                }
                else
                {
                    sb.Append(arg);
                }
            }
            return sb.ToString();
        }

        [STAThread]
        private static int Main(string[] args)
        {
            string selfPath = Process.GetCurrentProcess().MainModule.FileName;
            string baseDir = Path.GetDirectoryName(selfPath) ?? Environment.CurrentDirectory;
            string runtimeExe = Path.GetFullPath(
                Path.Combine(baseDir, "release", "Aether Music", "Aether Music.exe")
            );

            if (!File.Exists(runtimeExe))
            {
                MessageBoxW(
                    IntPtr.Zero,
                    "Khong tim thay tep chay Aether Music tai:\n" + runtimeExe +
                    "\n\nVui long chay 'npm run dist:win' trong thu muc du an.",
                    "Aether Music",
                    0x10
                );
                return 1;
            }

            IntPtr jobHandle = CreateJobObject(IntPtr.Zero, null);
            try
            {
                if (jobHandle != IntPtr.Zero)
                {
                    var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                    int size = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
                    IntPtr ptr = Marshal.AllocHGlobal(size);
                    try
                    {
                        Marshal.StructureToPtr(info, ptr, false);
                        SetInformationJobObject(
                            jobHandle,
                            JobObjectExtendedLimitInformation,
                            ptr,
                            (uint)size
                        );
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(ptr);
                    }
                }

                var psi = new ProcessStartInfo
                {
                    FileName = runtimeExe,
                    Arguments = QuoteArgs(args),
                    WorkingDirectory = Path.GetDirectoryName(runtimeExe) ?? baseDir,
                    UseShellExecute = false,
                };

                using (var proc = Process.Start(psi))
                {
                    if (proc == null) return 1;
                    if (jobHandle != IntPtr.Zero)
                    {
                        AssignProcessToJobObject(jobHandle, proc.Handle);
                    }
                    proc.WaitForExit();
                    return proc.ExitCode;
                }
            }
            catch (Exception ex)
            {
                MessageBoxW(
                    IntPtr.Zero,
                    "Khong the khoi dong Aether Music:\n" + ex.Message,
                    "Aether Music",
                    0x10
                );
                return 1;
            }
            finally
            {
                if (jobHandle != IntPtr.Zero)
                {
                    CloseHandle(jobHandle);
                }
            }
        }
    }
}
