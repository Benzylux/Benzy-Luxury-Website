class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = Number(statusCode) || 500;
    this.details = details;
  }
}

module.exports = AppError;
