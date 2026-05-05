const success = (res, message, data = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    status,
    message,
    data,
  });
};

const error = (res, err, status = 500) => {
  return res.status(status).json({
    success: false,
    status,
    message: err?.message || "Something went wrong",
    data: {},
  });
};

export { success, error };
