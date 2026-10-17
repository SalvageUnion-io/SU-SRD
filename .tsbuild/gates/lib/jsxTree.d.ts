/**
 * A TSX file as a tree a JSX rule can ask questions of: the parse, a walk that
 * hands each node its ancestors, a JSX element's name and attributes, the
 * string values an expression can take, and the file's own bindings by name.
 *
 * The `entity-nesting` rule set (`rules/entityNesting.ts`) reads components
 * this way because what it checks is a shape, not a spelling: which element
 * sits inside which, under which condition. A line regex cannot see that a
 * `TitledBox` is the consequent of `if (onPage)`, or that a slot's
 * `{crew}` is a local whose value is an `NpcInset`.
 */
export type Node = {
    type: string;
    start: number;
    end: number;
    [k: string]: unknown;
};
export declare const isNode: (v: unknown) => v is Node;
export type TsxFile = {
    /** Repo-relative path. */
    rel: string;
    program: Node;
    /** 1-based line of a source offset. */
    lineOf: (offset: number) => number;
    /**
     * What each name is bound to anywhere in the file: a variable's initialiser
     * or a function declaration. Scopes are flattened, which is close enough
     * for following a slot's `{crew}` back to the JSX it holds.
     */
    bindings: Map<string, Node[]>;
};
/**
 * Depth-first walk. `visit` gets each node and its ancestors, outermost
 * first; returning `false` skips the node's subtree.
 */
export declare function walk(node: Node, visit: (node: Node, ancestors: readonly Node[]) => boolean | undefined, ancestors?: Node[]): void;
/** Parse one TSX source. Pure: the caller reads the file. */
export declare function parseTsx(rel: string, source: string): TsxFile;
/** Strip the wrappers that do not change an expression's value. */
export declare function unwrap(node: Node): Node;
/** A `JSXElement`'s tag: `TitledBox`, `Dialog.Portal`. */
export declare function elementName(element: Node): string;
/** A `JSXElement`'s named attribute (spreads are not read). */
export declare function attribute(element: Node, name: string): Node | undefined;
/**
 * The component a node is drawn by, from its ancestors: the outermost
 * PascalCase function or const (`function NpcInset`, `const Peek = …`).
 */
export declare function componentOf(ancestors: readonly Node[]): string | null;
/**
 * An attribute's value as an expression: a string literal stays a literal, a
 * `{…}` container is its expression, and a bare attribute (`onPage`) is
 * `null`, meaning `true`.
 */
export declare function attributeValue(attr: Node): Node | null;
/**
 * The strings an expression can evaluate to, following conditionals and
 * logical operators to their leaves. `open` is true when some leaf is not a
 * string literal (an identifier, a call), so the list may not be all of them.
 */
export declare function stringValues(expr: Node | null): {
    values: string[];
    open: boolean;
};
