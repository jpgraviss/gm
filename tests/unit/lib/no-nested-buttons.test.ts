import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

/**
 * No `<button>` renders inside another `<button>`.
 *
 * AUDIT #786. Three components did: `CompanySelect` (a clear × inside the
 * dropdown trigger), the Pipelines accordion in Settings (a delete inside the
 * header), and `AiInsightsPanel` (a refresh inside the header). All three are
 * the same idea — put a small action in the right-hand corner of a big
 * clickable row — and all three are invalid HTML.
 *
 * It matters because the failure is not cosmetic. The HTML parser resolves
 * `<button><button/></button>` by lifting the inner button *out*, so the tree
 * the server sends and the tree React builds on the client genuinely differ,
 * and React reports a hydration error. All three sites had `stopPropagation`
 * on the inner handler, which is the tell: it was guarding against a nesting
 * the browser had already undone.
 *
 * The check parses each file with TypeScript rather than matching text. A
 * regex version of this was written first and was unusable — it read
 * `<button …/>` self-closing tags as unclosed, and `<button>` inside a comment
 * as real, and reported 32 nested buttons in one file that had none. Being
 * wrong in the noisy direction is not the safe failure it sounds like: it
 * buries the two genuine hits in a list nobody can act on.
 */

const root = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

/** The tag as written — `button`, `div`, `CompanySelect`. */
function tagOf(node: ts.Node, src: ts.SourceFile): string | null {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(src)
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText(src)
  return null
}

function nestedButtons(file: string): string[] {
  const src = ts.createSourceFile(
    file, readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  )
  const found: string[] = []
  const visit = (node: ts.Node, insideButton: boolean) => {
    const isButton = tagOf(node, src) === 'button'
    if (isButton && insideButton) {
      const { line } = src.getLineAndCharacterOfPosition(node.getStart(src))
      found.push(`${relative(root, file)}:${line + 1}`)
    }
    ts.forEachChild(node, child => visit(child, insideButton || isButton))
  }
  visit(src, false)
  return found
}

describe('no nested <button> elements (AUDIT #786)', () => {
  it('finds none in app/ or components/', () => {
    const offenders = ['app', 'components'].flatMap(dir =>
      walk(join(root, dir)).flatMap(nestedButtons),
    )
    expect(
      offenders,
      'a <button> inside a <button> is invalid HTML and causes a hydration ' +
      'error — move the inner control out and position it over the outer one:\n' +
      offenders.join('\n'),
    ).toEqual([])
  })

  it('detects the pattern it is meant to detect', () => {
    // Without this the test above passes just as happily against a walker that
    // never recurses. The fixture is the exact shape all three real sites had.
    const src = ts.createSourceFile('fixture.tsx', `
      export const X = () => (
        <div>
          <button onClick={a}>
            <span>Label</span>
            <button onClick={e => { e.stopPropagation(); b() }}>x</button>
          </button>
          <button onClick={c}>fine, a sibling</button>
        </div>
      )
    `, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

    const found: number[] = []
    const visit = (node: ts.Node, inside: boolean) => {
      const isButton = tagOf(node, src) === 'button'
      if (isButton && inside) found.push(src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1)
      ts.forEachChild(node, c => visit(c, inside || isButton))
    }
    visit(src, false)
    expect(found).toHaveLength(1)
  })

  it('does not count a self-closing button as still open', () => {
    // The regex attempt failed here: `<button … />` looks like an opening tag,
    // so everything after it in the file read as nested.
    const src = ts.createSourceFile('fixture.tsx', `
      export const X = () => (
        <div>
          {colors.map(c => <button key={c} onClick={() => pick(c)} />)}
          <button onClick={save}>Save</button>
        </div>
      )
    `, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

    const found: string[] = []
    const visit = (node: ts.Node, inside: boolean) => {
      const isButton = tagOf(node, src) === 'button'
      if (isButton && inside) found.push(node.getText(src).slice(0, 40))
      ts.forEachChild(node, c => visit(c, inside || isButton))
    }
    visit(src, false)
    expect(found).toEqual([])
  })
})
