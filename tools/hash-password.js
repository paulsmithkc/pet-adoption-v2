const bcrypt = require('bcrypt');

async function hashPassord(password) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

hashPassord('password').then(hash => console.log(hash));