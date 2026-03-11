import chalk from 'chalk'
import http from 'http'
import fs from 'fs/promises'
import path from 'path'

const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  const types = {
    '.html': 'text/html',
    '.txt': 'text/plain',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
  }
  return types[ext] || 'application/octet-stream'
}

const server = http.createServer(async (request, response) => {
  let filePath = request.url
  if (filePath === '/') {
    filePath = 'index.html'
  }

  const fullPath = path.join('public', filePath)

  try {
    const data = await fs.readFile(fullPath)
    response.statusCode = 200
    response.setHeader('Content-Type', getContentType(fullPath))
    response.write(data)
    response.end()
  } catch (err) {
    if (err.code === 'ENOENT') {
      response.statusCode = 404
      response.setHeader('Content-Type', 'text/plain')
      response.write('404 Not Found')
      response.end()
    } else {
      response.statusCode = 500
      response.setHeader('Content-Type', 'text/plain')
      response.write('Internal Server Error')
      response.end()
    }
  }
})

const PORT = 3000
server.listen(PORT, () => {
  console.log(chalk.green(`Server running at http://localhost:${PORT}/`))
})
