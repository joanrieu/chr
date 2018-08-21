const raw_rule = `prime(I), prime(J) <=> J % I !== 0, I !== 1 | prime(I), notprime(J)`

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
        return this.rule({ i: 0 })
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
        return token && guards && { i: guards.i, guards: [token.token, ...guards.guards] }
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
        if (!this.tokens[parse.i].match(/^\w+$/)) return
        return { i: parse.i + 1, identifier: this.tokens[parse.i] }
    }
}

console.log(JSON.stringify(new Parser(raw_rule).parse(), null, 4))
