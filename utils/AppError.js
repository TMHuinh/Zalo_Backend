const AppError = (statusCode, message, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

module.exports = { AppError };