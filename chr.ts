class ConstraintStore extends Set<number[]> {

    private queue: number[][] = []

    constructor(
        readonly rules: ((store: ConstraintStore, ...constraint: number[]) => void)[]
    ) {
        super()
    }

    add(constraint: number[]) {
        this.queue.push(constraint)
        while (this.queue.length > 0) {
            const constraint = this.queue.shift()
            let keep = true
            for (const rule of this.rules) {
                if (rule(this, ...constraint)) {
                    keep = false
                    break
                }
            }
            if (keep)
                super.add(constraint)
        }
        return this
    }

    toString(terms: object) {
        const rows = []
        for (const [term, ...values] of this) {
            const name = terms ? Object.entries(terms).find(([k, v]) => v === term)[0] : "_" + term
            rows.push(name + "(" + values.join(", ") + ")")
        }
        return rows.join("\n")
    }

}

// --------------------------------------------------------------------------------- //

enum Counter {
    upto,
    count,
    counted
}

namespace Counter {

    export const rules = [

        function start_rule(store: ConstraintStore, term: Counter, N: number) {
            if (term === Counter.upto) {
                store.add([Counter.count, 0, N])
                return true
            }
        },

        function count_rule(store: ConstraintStore, term: Counter, I: number, N: number) {
            if (term === Counter.count) {
                if (I < N)
                    store.add([Counter.count, I + 1, N])
            }
        },

        function counted_rule(store: ConstraintStore, term: Counter, I: number, N: number) {
            if (term === Counter.count) {
                store.add([Counter.counted, I])
                return true
            }
        }

    ]

}

enum Primes {
    upto,
    prime
}

namespace Primes {

    export const rules = [

        function gen_rule(store: ConstraintStore, term: Primes, N: number) {
            if (term === Primes.upto && N > 1) {
                store.add([Primes.upto, N - 1])
                store.add([Primes.prime, N])
                return true
            }
        },

        function sift_rule(store: ConstraintStore, term: Primes, Y: number) {
            if (term === Primes.prime)
                for (const [term2, X] of store.values())
                    if (term2 === Primes.prime && Y % X === 0)
                        return true
        }

    ]

}

console.log(new ConstraintStore(Counter.rules).add([Counter.upto, 10]).toString(Counter));
console.log(new ConstraintStore(Primes.rules).add([Primes.upto, 10]).toString(Primes));
