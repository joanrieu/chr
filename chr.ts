const assert = condition => { if (!condition) throw new Error("✖️✖️✖️") }

class System {
    constructor(
        readonly rules: Rule[],
        readonly constraints: Constraint[]
    ) { }

    toString() {
        return this.rules.join("\n")
    }

    static fromString(str: string) {
        const [rules, constraints] = str.split("\n---\n", 2)
        return new System(
            rules.split("\n").filter(l => !!l).map(Rule.fromString),
            constraints ? constraints.split("\n").map(Constraint.fromString) : []
        )
    }
}

class Rule {
    constructor(
        readonly name: string,
        readonly kept_heads: Constraint[],
        readonly removed_heads: Constraint[],
        readonly guards: Guard[],
        readonly body: Constraint[]
    ) { }

    toString() {
        let str = ""
        str += this.name || "_"
        str += " @ "
        str += this.kept_heads.join(", ") || "_"
        str += " \\ "
        str += this.removed_heads.join(", ") || "_"
        str += " | "
        str += this.guards.join(", ") || "_"
        str += " <=> "
        str += this.body.join(", ") || "_"
        return str
    }

    static fromString(str: string) {
        const [name, rule] = str.replace(/ /g, "").split("@", 2)
        const [lhs, rhs] = rule.split("<=>", 2)
        const [heads, guards] = lhs.split("|", 2)
        const [kept, removed] = heads.split("\\", 2)
        return new Rule(
            name,
            (kept + ",").split("),").slice(0, -1).map(Constraint.fromString),
            (removed + ",").split("),").slice(0, -1).map(Constraint.fromString),
            guards.split(",").map(Guard.fromString),
            (rhs + ",").split("),").slice(0, -1).map(Constraint.fromString),
        )
    }
}

class Constraint {
    constructor(
        readonly name: string,
        readonly body: Variable[]
    ) { }

    toString() {
        return this.name + "(" + this.body.join(", ") + ")"
    }

    static fromString(str: string) {
        return new Constraint(
            str.slice(0, str.indexOf("(")),
            str.slice(str.indexOf("(") + 1).split(",").map(Variable.fromString)
        )
    }
}

class Variable {
    constructor(
        readonly name: string
    ) { }

    toString() {
        return this.name
    }

    static fromString(str: string) {
        return new Variable(str)
    }
}

class Constant {
    constructor(
        readonly value: any
    ) { }

    toString() {
        return this.value
    }

    static fromString(str: string) {
        return new Constant(str)
    }
}

class Guard {
    constructor(
        readonly lhs: Variable,
        readonly op: ">" | ">=" | "=" | "!=" | "<=" | "<",
        readonly rhs: Constant
    ) { }

    toString() {
        return this.lhs + " " + this.op + " " + this.rhs
    }

    static fromString(str: string) {
        const [all, lhs, op, rhs] = str.match(/^(.+)(>|>=|=|!=|<=|<)(.+)$/)
        return new Guard(
            Variable.fromString(lhs),
            op as typeof Guard.prototype.op,
            Constant.fromString(rhs)
        )
    }
}

const system = System.fromString(`
start @ \\ upto(N) | N > 0 <=> count(0, N)
count @ count(I, N) \\ | I < N <=> count(I + 1, N)
`)

console.log(system.rules[1].body[0])
