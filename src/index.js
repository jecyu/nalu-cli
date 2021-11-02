const { Command } = require('commander')
const program = new Command()
const { tinyimg } = require('./commands/tinyimg')
const package = require('../package.json')

program
  .command('tinyimg')
  .description('压缩图片')
  .option('-d, --deep', '是否递归处理图片文件夹', false)
  .option('-r, --replace', '是否覆盖源文件', false)
  .action((commandAndOptions) => {
    tinyimg(commandAndOptions)
  })

program.version(package.version)
program.parse(process.argv)
