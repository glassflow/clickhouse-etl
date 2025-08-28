const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const port = 8080

// Function to create clickable URL in terminal
const createClickableUrl = (url) => {
  return `\x1b]8;;${url}\x07${url}\x1b]8;;\x07`
}

// Function to strip ANSI escape codes
const stripAnsi = (str) => {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\]8;;.*?\x07/g, '')
}

// Function to center text
const centerText = (text, width = 100) => {
  const visibleLength = stripAnsi(text).length
  const padding = Math.max(0, Math.floor((width - visibleLength) / 2))
  return ' '.repeat(padding) + text
}

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`
   _______  __          ___           _______.     _______. _______  __        ______   ____    __    ____
  /  _____||  |        /   \\         /       |    /       ||   ____||  |      /  __  \\  \\   \\  /  \\  /   /
 |  |  __  |  |       /  ^  \\       |   (----\`   |   (----|   |__   |  |     |  |  |  |  \\   \\/    \\/   /
 |  | |_ | |  |      /  /_\\  \\       \\   \\        \\   \\    |   __|  |  |     |  |  |  |   \\            /
 |  |__| | |  \`----./  _____  \\  .----)   |   .----)   |   |  |     |  \`----.|  \`--'  |    \\    /\\    /
  \\______| |_______/__/     \\__\\ |_______/    |_______/    |__|     |_______| \\______/      \\__/  \\__/
 
       `)
    console.log('═'.repeat(100))
    console.log(centerText('Glassflow Clickhouse ETL is up and running!'))
    console.log(centerText(`UI at ${createClickableUrl('http://localhost:8080')}`))
    console.log(centerText(`API at ${createClickableUrl('http://localhost:8080/api/v1')}`))
    console.log(
      centerText(`Backend at ${createClickableUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080')}`),
    )
    console.log(centerText(`Docs at ${createClickableUrl('https://docs.glassflow.dev')}`))
    console.log(centerText(`Get Help at ${createClickableUrl('https://www.glassflow.dev/contact-us')}`))
    console.log('═'.repeat(100))
    console.log('\n')
  })
})
