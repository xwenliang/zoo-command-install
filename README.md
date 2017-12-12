# zoo-command-install

## Usage

Usage: zoo install

Options:
	
	-h, --help	output usage information
	-F		do not detect local files, force to overwrite


## Example

在项目根目录创建zoo.json，执行`zoo install`，即可生成基础的fis-conf.js并安装zoo.json中声明依赖的模块

```
//zoo.json，具体使用时请去掉注释，否则会json解析报错
{
    "name": "example",//项目名称
    "downloadDirName": "modules",//模块安装目录
    "components": ["Zepto", "mo", "mod", "preload", "scrollPageCube"]//项目依赖的模块
}
```
