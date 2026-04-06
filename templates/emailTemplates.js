const registerTemplate = (fullName) => {
  return `
    <h2>Chào ${fullName} 👋</h2>
    <p>Bạn đã đăng ký tài khoản thành công.</p>
    <p>Chào mừng bạn đến với hệ thống 🚀</p>
  `;
};

const resetPasswordTemplate = (resetLink) => {
  return `
    <h2>Quên mật khẩu?</h2>
    <p>Click vào link bên dưới để đặt lại mật khẩu:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>Link sẽ hết hạn sau 10 phút.</p>
  `;
};

module.exports = {
  registerTemplate,
  resetPasswordTemplate,
};