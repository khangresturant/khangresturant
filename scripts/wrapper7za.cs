using System;
using System.Diagnostics;
using System.IO;

class Program {
    static int Main(string[] args) {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string real7za = Path.Combine(dir, "7za_real.exe");
        string cmdLine = Environment.CommandLine;
        int firstArg = -1;
        if (cmdLine.StartsWith("\"")) {
            firstArg = cmdLine.IndexOf('"', 1);
            if (firstArg >= 0) firstArg++;
        } else {
            firstArg = cmdLine.IndexOf(' ');
        }
        string passedArgs = (firstArg >= 0 && firstArg < cmdLine.Length) ? cmdLine.Substring(firstArg).Trim() : "";

        ProcessStartInfo psi = new ProcessStartInfo {
            FileName = real7za,
            Arguments = passedArgs,
            UseShellExecute = false
        };
        try {
            using (Process p = Process.Start(psi)) {
                p.WaitForExit();
                int code = p.ExitCode;
                if (code == 2) return 0;
                return code;
            }
        } catch (Exception ex) {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }
}
