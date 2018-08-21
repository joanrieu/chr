type Parse<T = { [k: string]: any }> = ({ i: number } & T) | undefined

class Parser {
    tokens: string[]

    constructor(rule: string) {
        this.tokens = this.tokenize(rule)
    }

    tokenize(rule: string) {
        return rule
            .split(/\s*(\w+|\||\,|\(|\))\s*/)
            .filter(part => part)
    }

    parse() {
        const parse = this.rule({ i: 0 })
        if (!parse || parse.i < this.tokens.length)
            throw new Error("invalid rule: " + this.tokens.join(" "))
        return parse
    }

    rule(parse: Parse) {
        const constraints_in = this.constraints(parse)
        const operation = this.operation(constraints_in)
        const guards = this.guards(operation)
        const constraints_out = this.constraints(guards)
        return constraints_in && operation && guards && constraints_out && {
            i: constraints_out.i,
            constraints_in: constraints_in.constraints,
            operation: operation.operation,
            guards: guards.guards,
            constraints_out: constraints_out.constraints
        }
    }

    constraints(parse: Parse): Parse<{ constraints: any[] }> {
        if (!parse) return
        const constraint = this.constraint(parse)
        const constraints = this.constraints(this.token(",", constraint))
        return constraint && {
            i: (constraints || constraint).i,
            constraints: [constraint, ...(constraints ? constraints.constraints : [])]
        }
    }

    constraint(parse: Parse) {
        if (!parse) return
        const name = this.identifier(parse)
        const lp = this.token("(", name)
        const args = this.constraint_args(lp)
        const rp = this.token(")", args)
        return name && lp && args && rp && {
            i: rp.i,
            name: name.identifier,
            args: args.args
        }
    }

    constraint_args(parse: Parse): Parse<{ args: any[] }> {
        if (!parse) return
        const arg = this.identifier(parse)
        const args = this.constraint_args(this.token(",", arg))
        return arg && {
            i: (args || arg).i,
            args: [arg.identifier, ...(args ? args.args : [])]
        }
    }

    guards(parse: Parse): Parse<{ guards: string }> {
        const guards = this.guards_expr(parse)
        return guards && { i: guards.i, guards: guards.guards.join(" ").replace(/,/g, "&&") }
    }

    guards_expr(parse: Parse): Parse<{ guards: any[] }> {
        if (!parse) return
        const end = this.token("|", parse)
        if (end) return { i: end.i, guards: parse.guards || []}
        const token = this.token(null, parse)
        const guards = this.guards_expr(token)
        return token && guards && {
            i: guards.i,
            guards: [
                (this.identifier(parse) ? "this." : "") + token.token,
                ...guards.guards
            ]
        }
    }

    operation(parse: Parse) {
        if (!parse) return
        const operation = this.token("<=>", parse) || this.token("==>", parse)
        return operation && { i: operation.i, operation: operation.token }
    }

    token(expected: string | null, parse: Parse) {
        if (!parse) return
        const actual = this.tokens[parse.i]
        if (expected && actual !== expected) return
        return { i: parse.i + 1, token: actual }
    }

    identifier(parse: Parse) {
        if (!parse) return
        if (!this.tokens[parse.i].match(/^[a-zA-Z]+$/)) return
        return { i: parse.i + 1, identifier: this.tokens[parse.i] }
    }
}

type Rule = {
    constraints_in: Constraint[],
    operation: string,
    guards: string,
    constraints_out: Constraint[],
}

type Constraint = {
    name: string,
    args: string[]
}

function build_rule(rule: Rule) {
    const fns = [
        ...rule.constraints_in.map(build_constraint),
        build_guard(rule.guards)
    ]
    let fn = build_inserter(rule)
    while (fns.length)
        fn = fns.pop()!(fn)
    return () => fn({})
}

const MATCHED_CONSTRAINTS = Symbol.for("MATCHED_CONSTRAINTS")

function build_constraint(constraint: Constraint) {
    return (next: (ctx: any) => void) => (ctx: any) => {
        for (const stored of constraint_store) {
            if (stored.name === constraint.name) {
                const nextCtx = {
                    ...ctx,
                    [MATCHED_CONSTRAINTS]: [...(ctx[MATCHED_CONSTRAINTS] || []), stored]
                }
                for (let i = 0; i < constraint.args.length; ++i)
                    nextCtx[constraint.args[i]] = stored.args[i]
                next(nextCtx)
            }
        }
    }
}

function build_guard(guard: string) {
    const fn = new Function("return " + guard)
    return (next: (ctx: any) => void) => (ctx: any) => {
        if (fn.call(ctx))
            next(ctx)
    }
}

function build_inserter(rule: Rule) {
    return (ctx: any) => {
        if (rule.operation === "<=>")
            for (const stored of ctx[MATCHED_CONSTRAINTS])
                constraint_store.splice(constraint_store.indexOf(stored), 1)
        constraint_store.push(...rule.constraints_out.map(constraint => ({
            name: constraint.name,
            args: constraint.args.map(arg => ctx[arg])
        })))
        constraint_store.dirty = true
    }
}

const rules = `
upto(N) <=> N > 1, (M = N - 1) | upto(M), prime(N)
prime(X), prime(Y) <=> Y > X, Y % X === 0 | prime(X)
`
    .split("\n")
    .filter(r => r.trim())
    .map(r => new Parser(r).parse() as Rule)
    .map(build_rule)

const constraint_store = Object.assign([
    { name: "upto", args: [ 100 ] }
], { dirty: true })

while (constraint_store.dirty) {
    constraint_store.dirty = false
    for (const rule of rules)
        rule()
}

console.log(constraint_store.map(c => c.name + "(" + c.args.join(", ") + ")").join("\n"))
