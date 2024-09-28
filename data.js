// data.js
const fs = require('fs-extra');
const path = require('path');

const usuariosFilePath = path.join(__dirname, 'usuarios.json');

// Função para salvar os dados do usuário
async function salvarDadosUsuario(usuarioData) {
  try {
    const existe = await fs.pathExists(usuariosFilePath);
    let usuarios = [];
    if (existe) {
      const data = await fs.readFile(usuariosFilePath, 'utf8');
      usuarios = JSON.parse(data);
    }
    usuarios.push(usuarioData);
    await fs.writeFile(usuariosFilePath, JSON.stringify(usuarios, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao salvar os dados do usuário:', error);
  }
}

module.exports = {
  salvarDadosUsuario,
};
