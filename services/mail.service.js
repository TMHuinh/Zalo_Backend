const sgMail = require("@sendgrid/mail");

// Set API Key từ biến môi trường
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  const msg = {
    to, // Người nhận
    from: `"Chat App" <${process.env.SENDGRID_FROM_EMAIL}>`, // Sender email đã verify trên SendGrid
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    // console.log("Gửi email thành công qua SendGrid");
  } catch (error) {
    console.error("Lỗi khi gửi email:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error; // Ném lỗi để UserService bắt được trong khối try...catch
  }
};

module.exports = { sendEmail };