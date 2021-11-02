const fs = require('fs')
const path = require('path')
const https = require('https')
const URL = require('url').URL
const inquirer = require('inquirer')
const inquirerFileTreeSelection = require('inquirer-file-tree-selection-prompt')

inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection)

const tinyConfig = {
  files: [],
  entry: '',
  deepLoop: false, // 是否递归处理
  replace: false, // 是否覆盖源文件
  exts: ['.jpg', '.png', '.jpeg'],
  max: 5120000 // 5MB
}

exports.tinyimg = async (commandAndOptions) => {
  const answer = await inquirer.prompt([
    {
      name: 'path', // 键
      type: 'file-tree-selection',
      message: '(必选) 压缩的图片文件夹路径/文件'
    }
  ])
  const { path } = answer

  tinyConfig.entry = path
  tinyConfig.replace = commandAndOptions && commandAndOptions.replace
  tinyConfig.deepLoop = commandAndOptions && commandAndOptions.deepLoop

  
  fileFilter(tinyConfig.entry)
  
  console.log('等待处理文件的数量：', tinyConfig.files.length)
  console.log('本次执行脚本的配置：', tinyConfig)
  tinyConfig.files.forEach((img) => fileUpload(img))
}

/**
 * 过滤待处理文件夹，得到待处理文件列表
 */
function fileFilter(sourcePath) {
  const fileStat = fs.statSync(sourcePath)
  if (fileStat.isDirectory()) {
    fs.readdirSync(sourcePath).forEach((file) => {
      const fullFilePath = path.join(sourcePath, file)
      // 读取文件信息
      const fileStat = fs.statSync(fullFilePath)
      // 过滤大小、后缀名
      if (
        fileStat.size <= tinyConfig.max &&
        fileStat.isFile() &&
        tinyConfig.exts.includes(path.extname(file))
      ) {
        tinyConfig.files.push(fullFilePath)
      } else if (tinyConfig.deepLoop && fileStat.isDirectory()) {
        // 是否要深度递归
        fileFilter(fullFilePath)
      }
    })
  } else {
    if (
      fileStat.size <= tinyConfig.max &&
      fileStat.isFile() &&
      tinyConfig.exts.includes(path.extname(file))
    ) {
      tinyConfig.files.push(sourcePath)
    }
  }
}

/**
 * TinyPng 远程压缩 HTTPS 请求
 * success {
 *   "input": { "size": 887, "type": "image/png"},
 *   "output": {
 *     "size": 785, "type": "image/png", "width": 81, "height": 81, "ratio": 0.885,
 *     "url": "https://tinypng.com/web/output/xxx"
 *   }
 * }
 */
function fileUpload(imgPath) {
  const req = https.request(getAjaxOptions(), (res) => {
    res.on('data', (buf) => {
      const obj = JSON.parse(buf.toString())
      if (obj.error) {
        console.log(`压缩失败! \n 当前文件：${imgPath} \n ${obj.message}`)
      } else {
        fileUpdate(imgPath, obj) // 更新文件到本地
      }
    })
  })
  req.write(fs.readFileSync(imgPath), 'binary')
  req.on('error', (err) => {
    console.error(`请求错误 \n 当前文件：${imgPath} \n ${err}`)
  })
  req.end()
}

/**
 * 请求压缩好的图片，更新到本地路径
 */
function fileUpdate(entryImgPath, obj) {
  const url = new URL(obj.output.url)
  const req = https.request(url, (res) => {
    let body = ''
    res.setEncoding('binary')
    res.on('data', (data) => {
      body += data
    })
    res.on('end', () => {
      const [filename, extendsion] = entryImgPath.split('.')
      if (!tinyConfig.replace) {
        // 是否覆盖源文件
        entryImgPath = filename + '_tiny' + '.' + extendsion
      }
      fs.writeFile(entryImgPath, body, 'binary', (err) => {
        if (err) return console.log(err)
        let log = '压缩成功：'
        log += `优化比例：${((1 - obj.output.ratio) * 100).toFixed(2)}%，`
        log += `原始大小：${(obj.input.size / 1024).toFixed(2)}KB，`
        log += `压缩大小：${(obj.output.size / 1024).toFixed(2)}KB，`
        log += `文件：${entryImgPath}`
        console.log(log)
      })
    })
  })
  req.on('error', (e) => console.log(e))
  req.end()
}

/**
 * Tiny 远程压缩 HTTPS 请求的配置，构造浏览器请求信息
 */
function getAjaxOptions() {
  return {
    method: 'POST',
    hostname: 'tinypng.com',
    path: '/web/shrink',
    headers: {
      rejectUnauthorized: false,
      'X-Forwarded-For': Array(4)
        .fill(1)
        .map(() => parseInt(Math.random() * 254) + 1)
        .join('.'), // 伪造随机 ip，避免限制
      'Postman-Token': Date.now(),
      'Cache-control': 'no-cache',
      'Content-type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (Window NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    }
  }
}
