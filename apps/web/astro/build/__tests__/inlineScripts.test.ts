import { describe, expect, it } from 'bun:test'
import { executableInlineScripts, scriptHash, withScriptHashes } from '../inlineScripts'

describe('executableInlineScripts', () => {
  it('finds the bodies script-src gates, and none it does not', () => {
    const html =
      '<script>run()</script><script type="module">mod()</script>' +
      '<script type="speculationrules">{"prefetch":[]}</script>' +
      '<script src="/a.js"></script><script type="application/ld+json">{}</script>' +
      '<script type="application/json">{}</script>'
    expect(executableInlineScripts(html)).toEqual(['run()', 'mod()', '{"prefetch":[]}'])
  })
})

describe('withScriptHashes', () => {
  const headers = [
    '/*',
    "  # script-src carries NO 'unsafe-inline'; it is hashed",
    "  Content-Security-Policy: default-src 'self'; script-src 'self' https://x.test; style-src 'self';",
  ].join('\n')

  it("adds the hashes to the policy's script-src, not to a comment", () => {
    const out = withScriptHashes(headers, [scriptHash('b()'), scriptHash('a()')])
    const [, comment, policy] = out.split('\n')
    expect(comment).toBe("  # script-src carries NO 'unsafe-inline'; it is hashed")
    expect(policy).toStartWith(
      "  Content-Security-Policy: default-src 'self'; script-src 'self' https://x.test 'sha256-"
    )
    expect(policy).toEndWith("; style-src 'self';")
    expect(policy?.match(/'sha256-/g)).toHaveLength(2)
  })

  it('hashes as the browser does: sha256 of the body, base64', () => {
    expect(scriptHash('alert(1)')).toBe("'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='")
  })

  it('refuses a file with no policy to add them to', () => {
    expect(() => withScriptHashes('/*\n  X-Frame-Options: DENY', [])).toThrow('no CSP script-src')
  })
})
