const { check, validationResult } = require("express-validator");

// Simple query/body validator builder
exports.queryValidator = (rules = []) => {
  return (req, res, next) => {
    // Apply defaults and simple type coercion
    for (const rule of rules) {
      const { name, type, default: def, required } = rule;
      let value = req.query[name] ?? req.body[name] ?? undefined;
      if (value === undefined && def !== undefined) {
        req.query[name] = def;
        continue;
      }
      if (value !== undefined && type) {
        try {
          if (type === "number") req.query[name] = Number(value);
          else if (type === "date") req.query[name] = new Date(value);
        } catch (e) {
          // ignore
        }
      }
      // Use the resolved `value` (which may come from req.query or req.body)
      if (required && (value === undefined || value === "")) {
        return res
          .status(400)
          .json({ success: false, message: `${name} is required` });
      }
      // If value came from body but downstream code expects req.query, copy it there
      if (value !== undefined && req.query[name] === undefined) {
        req.query[name] = value;
      }
    }
    next();
  };
};

// Simple validate middleware (placeholder for express-validator)
exports.validate = (req, res, next) => {
  // If express-validator used elsewhere, could check results.
  next();
};
