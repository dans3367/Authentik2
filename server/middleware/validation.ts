import { body, param, query, ValidationChain } from "express-validator";

// Common validation rules
export const emailValidation = body("email")
  .isEmail()
  .normalizeEmail()
  .withMessage("Invalid email format");

export const passwordValidation = body("password")
  .isLength({ min: 8 })
  .withMessage("Password must be at least 8 characters long")
  .matches(/[A-Z]/)
  .withMessage("Password must contain at least one uppercase letter")
  .matches(/[a-z]/)
  .withMessage("Password must contain at least one lowercase letter")
  .matches(/[0-9]/)
  .withMessage("Password must contain at least one number")
  .matches(/[!@#$%^&*(),.?":{}|<>]/)
  .withMessage("Password must contain at least one special character");

export const nameValidation = (field: string) =>
  body(field)
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage(`${field} must be between 1 and 100 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`);

export const uuidValidation = (field: string) =>
  param(field).isUUID().withMessage(`${field} must be a valid UUID`);

export const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

export const slugValidation = body("slug")
  .trim()
  .isLength({ min: 3, max: 50 })
  .withMessage("Slug must be between 3 and 50 characters")
  .matches(/^[a-z0-9-]+$/)
  .withMessage("Slug can only contain lowercase letters, numbers, and hyphens")
  .not()
  .matches(/^-|-$/)
  .withMessage("Slug cannot start or end with a hyphen");

// Authentication validations
export const loginValidation = [
  emailValidation,
  body("password").notEmpty().withMessage("Password is required"),
  body("rememberMe").optional().isBoolean(),
  body("twoFactorToken").optional().isString(),
];

export const registrationValidation = [
  emailValidation,
  passwordValidation,
  nameValidation("firstName"),
  nameValidation("lastName"),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),
];

export const forgotPasswordValidation = [emailValidation];

export const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  passwordValidation,
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),
];

// User management validations
export const createUserValidation = [
  emailValidation,
  passwordValidation,
  nameValidation("firstName"),
  nameValidation("lastName"),
  body("role")
    .isIn(["Administrator", "Manager", "Employee"])
    .withMessage("Invalid role"),
];

export const updateUserValidation = [
  uuidValidation("id"),
  body("email").optional().isEmail().normalizeEmail(),
  nameValidation("firstName").optional(),
  nameValidation("lastName").optional(),
  body("role")
    .optional()
    .isIn(["Administrator", "Manager", "Employee"]),
];

// Form validations
export const formValidation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Form name must be between 1 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("fields").isArray().withMessage("Fields must be an array"),
  body("theme")
    .optional()
    .isIn([
      "default",
      "modern",
      "minimal",
      "dark",
      "playful",
      "professional",
      "gradient",
      "glassmorphism",
      "neon",
      "vintage",
      "cyberpunk",
      "pastel",
      "brutalist",
      "material",
    ]),
];

// Sanitize HTML content
export const sanitizeHtmlValidation = (field: string) =>
  body(field)
    .customSanitizer((value) => {
      // Remove script tags and dangerous attributes
      if (typeof value !== "string") return value;
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
        .replace(/javascript:/gi, "");
    });