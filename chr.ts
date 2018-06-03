class ConstraintStore extends Set<number[]> {

    constructor(
        readonly rules: ((store: ConstraintStore, ...constraint: number[])
            => IterableIterator<number[] | boolean>)[]
    ) {
        super()
    }

    add(constraint: number[]) {
        let iterators = [this.applyConstraint(constraint)]
        while (iterators.length > 0) {
            const it = iterators[iterators.length - 1]
            const { done, value: newConstraint } = it.next()
            if (newConstraint)
                iterators.push(this.applyConstraint(newConstraint))
            else if (done)
                iterators.pop()
        }
        return this
    }

    *applyConstraint(constraint: number[]) {
        let drop = false
        for (const rule of this.rules) {
            for (const newConstraint of rule(this, ...constraint)) {
                if (newConstraint === true)
                    drop = true
                else if (newConstraint === false)
                    throw new Error(rule.name + " ==> false")
                else
                    yield newConstraint
            }
            if (drop)
                break
        }
        if (!drop)
            super.add(constraint)
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

        function* start_rule(store: ConstraintStore, term: Counter, N: number) {
            if (term === Counter.upto) {
                yield [Counter.count, 0, N]
                yield true
            }
        },

        function* count_rule(store: ConstraintStore, term: Counter, I: number, N: number) {
            if (term === Counter.count && I < N)
                yield [Counter.count, I + 1, N]
        },

        function* counted_rule(store: ConstraintStore, term: Counter, I: number, N: number) {
            if (term === Counter.count) {
                yield [Counter.counted, I]
                yield true
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

        function* gen_rule(store: ConstraintStore, term: Primes, N: number) {
            if (term === Primes.upto && N > 1) {
                yield [Primes.upto, N - 1]
                yield [Primes.prime, N]
                yield true
            }
        },

        function* sift_rule(store: ConstraintStore, term: Primes, Y: number) {
            if (term === Primes.prime)
                for (const [term2, X] of store.values())
                    if (term2 === Primes.prime && Y % X === 0)
                        yield true
        }

    ]

}

console.log(new ConstraintStore(Counter.rules).add([Counter.upto, 10]).toString(Counter));
console.log(new ConstraintStore(Primes.rules).add([Primes.upto, 10000]).toString(Primes));
