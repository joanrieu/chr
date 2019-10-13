const fs = require("fs");
const assert = require("assert");

function buildConstraint(constraint) {
  let variables = [];
  const regex = /^([A-Z0-9]+|[0-9]+)$/;
  const name = constraint
    .trim()
    .split(/\s+|\b/)
    .map(word =>
      word.match(regex)
        ? "_" +
          (variables.push(isNaN(parseInt(word)) ? word : parseInt(word)),
          variables.length)
        : word
    )
    .join(" ");
  let expression = constraint.trim().match(/^\(.+\)$/);
  if (expression)
    expression = new Function(
      "variables",
      "return " +
        name.replace(/\b_\d+\b/g, x => "variables[" + (x.slice(1) - 1) + "]")
    );
  constraint = { name, variables, expression };
  // console.log(constraint);
  return constraint;
}

function buildChainableConstraint(prototype, remove = false) {
  return function(cb) {
    return {
      [prototype.name](
        store,
        removable_constraints,
        addable_constraints,
        used_constraints,
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
              new_removable_constraints,
              addable_constraints,
              new_used_constraints,
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
        removable_constraints,
        addable_constraints,
        used_constraints,
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
          removable_constraints,
          new_addable_constraints,
          used_constraints,
          bound_variables
        );
      }
    }[prototype.name];
  };
}

function buildChainableEvaluation(prototype, guard = false) {
  return function(cb) {
    return {
      [prototype.name](
        store,
        removable_constraints,
        addable_constraints,
        used_constraints,
        bound_variables
      ) {
        const values = prototype.variables.map(name =>
          typeof name === "string" ? bound_variables.get(name) : name
        );
        // console.log(prototype.name, values);
        const new_values = [...values];
        if (prototype.expression.call(undefined, new_values) || !guard) {
          const new_bound_variables = new Map(bound_variables);
          prototype.variables.forEach((name, i) => {
            if (new_values[i] !== values[i])
              new_bound_variables.set(name, new_values[i]);
          });
          return cb(
            store,
            removable_constraints,
            addable_constraints,
            used_constraints,
            new_bound_variables
          );
        }
      }
    }[prototype.name];
  };
}

function buildRule(rule) {
  const { name, heads, guards, body } = rule;
  let chain = [];
  for (const constraint of heads)
    if (constraint.expression) chain.push(buildChainableEvaluation(constraint));
    else chain.push(buildChainableConstraint(constraint, true));
  for (const constraint of guards)
    if (constraint.expression)
      chain.push(buildChainableEvaluation(constraint, true));
    else chain.push(buildChainableConstraint(constraint));
  for (const constraint of body)
    if (constraint.expression) chain.push(buildChainableEvaluation(constraint));
    else chain.push(buildChainableBody(constraint));
  return {
    [name](store) {
      // console.log("trying", name);
      const addable_constraints = new Set();
      let action = false;
      chain.reduceRight(
        (tail, head) => head(tail),
        (
          store,
          removable_constraints,
          new_addable_constraints,
          used_constraints,
          bound_variables
        ) => {
          // console.log(name, "successful");
          for (const constraint of removable_constraints) {
            if (store.includes(constraint)) {
              // console.log("removing from store", constraint);
              store.splice(store.indexOf(constraint), 1);
              action = true;
            }
          }
          for (const constraint of new_addable_constraints)
            addable_constraints.add(constraint);
        }
      )(store, new Set(), new Set(), new Set(), new Map());
      for (const constraint of addable_constraints) {
        if (constraint.name !== "true") {
          // console.log("adding to store", constraint);
          store.unshift(constraint);
          action = true;
        }
      }
      return action;
    }
  }[name];
}

function applyRules(rules, store) {
  let action = false;
  for (const rule of rules) action = rule(store) || action;
  return action;
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
while (applyRules(rules, store)) {
  console.log();
  console.log("round", ++round);
  printStore(store);
}
