import { expect, test } from "bun:test"
import { getLocalProcessCommand } from "../../src/platform/process-shell"

test("POSIX hosts keep the login shell, with single quotes in the command escaped", () => {
  const launch = getLocalProcessCommand({ command: "echo 'ok'", env: { SHELL: "/bin/zsh" }, platform: "linux" })

  expect(launch).toEqual({ cmd: "/bin/zsh", args: ["-c", "exec /bin/zsh -c 'echo '\\''ok'\\'''"] })
  expect(getLocalProcessCommand({ command: "npm run dev", env: {}, platform: "darwin" }).cmd).toBe("/bin/sh")
})

test("Windows runs the command through ComSpec, never /bin/sh", () => {
  const launch = getLocalProcessCommand({
    command: "npm run dev",
    env: { ComSpec: String.raw`C:\Windows\system32\cmd.exe`, SHELL: "/bin/sh" },
    platform: "win32",
  })

  expect(launch).toEqual({ cmd: String.raw`C:\Windows\system32\cmd.exe`, args: ["/d", "/s", "/c", "npm run dev"] })
  expect(getLocalProcessCommand({ command: "x", env: { COMSPEC: "D:\\cmd.exe" }, platform: "win32" }).cmd).toBe(
    "D:\\cmd.exe",
  )
  expect(getLocalProcessCommand({ command: "x", env: {}, platform: "win32" }).cmd).toBe("cmd.exe")
})

test.skipIf(process.platform !== "win32").each([
  {
    name: "command chaining",
    command: "echo touri-first&& echo touri-second",
    lines: ["touri-first", "touri-second"],
  },
  {
    name: "quoted arguments and metacharacters",
    command: 'echo "touri-first & touri-second"',
    lines: ['"touri-first & touri-second"'],
  },
  {
    name: "a quoted executable path and script argument",
    command: `"${process.execPath}" -e "console.log('touri first & second')"`,
    lines: ["touri first & second"],
  },
])(
  "a Windows project command preserves $name through the desktop helper",
  async ({ command, lines }) => {
    const helper = process.env.TOURI_DESKTOP_HELPER
    if (!helper)
      throw new Error("Windows platform tests need TOURI_DESKTOP_HELPER (see scripts/test-sidecar-portable.ts)")
    const { cmd, args } = getLocalProcessCommand({
      command,
      env: process.env as Record<string, string>,
    })

    const child = Bun.spawn({
      cmd: [helper, "--spawn-tree", "--", cmd, ...args],
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(10_000),
    })
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])

    expect(stderr).not.toContain("ConPTY helper")
    expect(code).toBe(0)
    expect(stdout.split(/\r?\n/).filter(Boolean)).toEqual(Array.from(lines))
  },
  30_000,
)
