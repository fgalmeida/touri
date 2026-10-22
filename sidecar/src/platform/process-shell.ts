/**
 * The command interpreter that runs a project process locally. POSIX hosts keep `sh -c`;
 * Windows has no `/bin/sh`, so it uses the system `cmd.exe` (ComSpec), with `/d` to skip AutoRun
 * scripts and `/s` so cmd strips only the quotes the launcher adds around the command.
 */
export const getLocalProcessCommand = ({
  command,
  env,
  platform = process.platform,
}: {
  command: string
  env: Record<string, string>
  platform?: NodeJS.Platform
}): { cmd: string; args: string[] } => {
  if (platform === "win32") return { cmd: getWindowsCommandInterpreter(env), args: ["/d", "/s", "/c", command] }
  const shell = env.SHELL ?? "/bin/sh"
  return { cmd: shell, args: ["-c", `exec ${shell} -c '${command.replaceAll("'", "'\\''")}'`] }
}

/** Windows environment names are case-insensitive, so ComSpec may arrive as COMSPEC or comspec. */
const getWindowsCommandInterpreter = (env: Record<string, string>): string =>
  Object.entries(env).find(([name]) => name.toUpperCase() === "COMSPEC")?.[1] || "cmd.exe"
