const AppError = (status, message, code) => ({
  status,
  message,
  code,
});
module.exports = { AppError };
