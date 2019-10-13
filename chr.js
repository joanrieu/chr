const fs = require("fs");
const assert = require("assert");
const util = require("util");

function buildConstraint(constraint) {
  constraint = constraint.trim().split(/\s+|\b/);
  const variables = [];
  const name = constraint
    .map(word =>
      word.match(/^[A-Z]\w*$/)
        ? "_" + (variables.push(word), variables.length)
        : word
    )
    .join(" ");
  constraint = { name, variables };
  return constraint;
}

function buildChainableConstraint(prototype, remove = false) {
  return function(cb) {
    return {
      [prototype.name](
        store,
        used_constraints,
        removable_constraints,
        addable_constraints,
        bound_variables
      ) {
        for (const candidate of store) {
          if (
            candidate.name === prototype.name &&
            !used_constraints.has(candidate)
          ) {
            const new_used_constraints = new Set(used_constraints);
            new_used_constraints.add(candidate);
            const new_removable_constraints = new Set(removable_constraints);
            if (remove) new_removable_constraints.add(candidate);
            const new_bound_variables = new Map(bound_variables);
            if (
              candidate.variables.some((value, index) => {
                const name = prototype.variables[index];
                if (
                  new_bound_variables.has(name) &&
                  new_bound_variables.get(name) !== value
                )
                  return true;
                new_bound_variables.set(name, value);
              })
            )
              continue;
            cb(
              store,
              new_used_constraints,
              new_removable_constraints,
              addable_constraints,
              new_bound_variables
            );
          }
        }
      }
    }[prototype.name];
  };
}

function buildChainableBody(prototype) {
  return function(cb) {
    return {
      [prototype.name](
        store,
        used_constraints,
        removable_constraints,
        addable_constraints,
        bound_variables
      ) {
        const new_addable_constraints = new Set(addable_constraints);
        const constraint = {
          name: prototype.name,
          variables: prototype.variables.map(name => bound_variables.get(name))
        };
        new_addable_constraints.add(constraint);
        cb(
          store,
          used_constraints,
          removable_constraints,
          new_addable_constraints,
          bound_variables
        );
      }
    }[prototype.name];
  };
}

function buildRule(rule) {
  const { name, heads, guards, body } = rule;
  let chain = [];
  for (const constraint of heads)
    chain.push(buildChainableConstraint(constraint, true));
  for (const constraint of guards)
    chain.push(buildChainableConstraint(constraint));
  for (const constraint of body) chain.push(buildChainableBody(constraint));
  let action;
  chain = chain.reduceRight(
    (tail, head) => head(tail),
    (
      store,
      used_constraints,
      removable_constraints,
      addable_constraints,
      bound_variables
    ) => {
      // console.log(name, "success");
      for (const constraint of removable_constraints) {
        // console.log("removing from store", constraint);
        store.splice(store.indexOf(constraint), 1);
        action = true;
      }
      for (const constraint of addable_constraints) {
        if (
          constraint.name !== "true" &&
          !store.some(
            other =>
              other.name === constraint.name &&
              other.variables.join() === constraint.variables.join()
          )
        ) {
          // console.log("adding to store", constraint);
          store.unshift(constraint);
          action = true;
        }
      }
    }
  );
  return {
    [name](store) {
      // console.log("trying", name);
      action = false;
      chain(store, new Set(), new Set(), new Set(), new Map());
      return action;
    }
  }[name];
}

let rules = process.argv[2];
assert(rules, "no rules file name");

let store = process.argv[3];
assert(store, "no store file name");

rules = fs
  .readFileSync(rules, "utf8")
  .split("\n")
  .filter(line => line.trim());

store = fs
  .readFileSync(store, "utf8")
  .split("\n")
  .filter(line => line.trim());

rules = rules.map(line => {
  const columns = line.split("\t");
  // console.log("rule", columns);
  assert(columns.length === 4);

  let [name, heads, guards, body] = columns;
  heads = heads
    .split(",")
    .filter(col => col.trim())
    .map(buildConstraint);
  guards = guards
    .split(",")
    .filter(col => col.trim())
    .map(buildConstraint);
  body = body
    .split(",")
    .filter(col => col.trim())
    .map(buildConstraint);
  assert((heads.length || guards.length) && body.length);

  const rule = buildRule({ name, heads, guards, body });
  return rule;
});

store = store.map(line => {
  // console.log("constraint", line);
  return buildConstraint(line);
});

function reverse(arr) {
  for (let i1 = 0; i1 < arr.length / 2; ++i1) {
    const tmp = arr[i1];
    const i2 = arr.length - 1 - i1;
    arr[i1] = arr[i2];
    arr[i2] = tmp;
  }
}

reverse(store);

function printStore(store) {
  for (let i = store.length - 1; i >= 0; --i) {
    const constraint = store[i];
    let text = constraint.name;
    for (let j = 0; j < constraint.variables.length; ++j) {
      text = text.replace(
        new RegExp("\\b_" + (j + 1) + "\\b"),
        constraint.variables[j]
      );
    }
    console.log(text);
  }
}

let round = 0;
printStore(store);
while (rules.filter(rule => rule(store)).length) {
  console.log();
  console.log("round", ++round);
  printStore(store);
}
