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

type Parse<T = { [k: string]: any }> = ({ tokens: string[] } & T) | undefined

class Parser {
    static parseRules(rules: string) {
        const tokens = this.tokenize(rules)
        const parse = Parser.rules({ tokens })
        if (!parse || parse.tokens.length > 0)
            throw new Error("parse error: " + tokens.join(" "))
        return parse.rules as Rule[]
    }

    private static tokenize(rules: string) {
        return rules
            .trim()
            .replace(/\n+/g, ";")
            .split(/\s*(\w+|\||,|\(|\)|;)\s*/)
            .filter(part => part)
    }

    private static rules(parse: Parse): Parse<{ rules: any[] }> {
        if (!parse) return
        const rule = this.rule(parse)
        const rules = this.rules(this.token(";", rule))
        return rule && {
            tokens: (rules || rule).tokens,
            rules: [rule, ...(rules ? rules.rules : [])]
        }
    }

    private static rule(parse: Parse): Parse<{ constraints_in: any[]; operation: string; guards: string; constraints_out: any[] }> {
        if (!parse) return
        const constraints_in = this.constraints(parse)
        const operation = this.operation(constraints_in)
        const guards = this.guards(operation)
        const constraints_out = this.constraints(guards)
        return constraints_in && operation && guards && constraints_out && {
            tokens: constraints_out.tokens,
            constraints_in: constraints_in.constraints,
            operation: operation.operation,
            guards: guards.guards,
            constraints_out: constraints_out.constraints
        }
    }

    private static constraints(parse: Parse): Parse<{ constraints: any[] }> {
        if (!parse) return
        const constraint = this.constraint(parse)
        const constraints = this.constraints(this.token(",", constraint))
        return constraint && {
            tokens: (constraints || constraint).tokens,
            constraints: [constraint, ...(constraints ? constraints.constraints : [])]
        }
    }

    private static constraint(parse: Parse): Parse<{ name: string, args: any[] }> {
        if (!parse) return
        const name = this.identifier(parse)
        const lp = this.token("(", name)
        const args = this.constraint_args(lp)
        const rp = this.token(")", args)
        return name && lp && args && rp && {
            tokens: rp.tokens,
            name: name.identifier,
            args: args.args
        }
    }

    private static constraint_args(parse: Parse): Parse<{ args: any[] }> {
        if (!parse) return
        const arg = this.identifier(parse)
        const args = this.constraint_args(this.token(",", arg))
        return arg && {
            tokens: (args || arg).tokens,
            args: [arg.identifier, ...(args ? args.args : [])]
        }
    }

    private static guards(parse: Parse): Parse<{ guards: string }> {
        const guards = this.guards_expr(parse)
        return guards && { tokens: guards.tokens, guards: guards.guards.join(" ").replace(/,/g, "&&") }
    }

    private static guards_expr(parse: Parse): Parse<{ guards: any[] }> {
        if (!parse) return
        const end = this.token("|", parse)
        if (end) return { tokens: end.tokens, guards: parse.guards || []}
        const token = this.token(null, parse)
        const guards = this.guards_expr(token)
        return token && guards && {
            tokens: guards.tokens,
            guards: [
                (this.identifier(parse) ? "this." : "") + token.token,
                ...guards.guards
            ]
        }
    }

    private static operation(parse: Parse): Parse<{ operation: string }> {
        if (!parse) return
        const operation = this.token("<=>", parse) || this.token("==>", parse)
        return operation && { tokens: operation.tokens, operation: operation.token }
    }

    private static token(expectedToken: string | null, parse: Parse): Parse<{ token: string }> {
        if (!parse) return
        const [token, ...tokens] = parse.tokens
        if (expectedToken && token !== expectedToken) return
        return { tokens, token }
    }

    private static identifier(parse: Parse): Parse<{ identifier: string }> {
        if (!parse) return
        const [identifier, ...tokens] = parse.tokens
        if (!identifier.match(/^[a-zA-Z]+$/)) return
        return { tokens, identifier }
    }
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

const rules = Parser.parseRules(`
upto(N) <=> N > 1, (M = N - 1) | upto(M), prime(N)
prime(X), prime(Y) <=> Y > X, Y % X === 0 | prime(X)
`)

const built_rules = rules.map(build_rule)

const constraint_store = Object.assign([
    { name: "upto", args: [ 100 ] }
], { dirty: true })

while (constraint_store.dirty) {
    constraint_store.dirty = false
    for (const rule of built_rules)
        rule()
}

console.log(constraint_store.map(c => c.name + "(" + c.args.join(", ") + ")").join("\n"))
