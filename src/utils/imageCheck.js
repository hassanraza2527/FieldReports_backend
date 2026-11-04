/** JPEG files start with FF D8 FF. Cheap sanity check; we are not decoding the image. */
function isJpeg(buf) {
  return Buffer.isBuffer(buf) && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

module.exports = { isJpeg };
