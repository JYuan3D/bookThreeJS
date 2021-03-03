const { src, dest, series, parallel, watch } = require('gulp')
const preprocess = require('gulp-preprocess')
// JS
const babel = require('gulp-babel')
const uglify = require('gulp-uglify')
const ignore = require('gulp-ignore')
const browserify = require('browserify')
const stream = require('vinyl-source-stream')
const buffer = require('vinyl-buffer')
// const concat = require('gulp-concat')
// const rename = require('gulp-rename')
// const sourcemaps = require('gulp-sourcemaps')
// CSS
const sass = require('gulp-sass')
const autoprefixer = require('autoprefixer')
const postcss = require('gulp-postcss')
const cleancss = require('gulp-clean-css')
// HTML
const htmltpl = require('gulp-html-tpl')
const artTemplate = require('art-template')
const htmlmin = require('gulp-htmlmin')
// OTHER
const del = require('del')
const vinylPaths = require('vinyl-paths')
const browserSync = require('browser-sync').create()
const { createProxyMiddleware } = require('http-proxy-middleware')

const config = {
  srcDir: './src',
  destDir: './public',
  distDir: './dist'
}

const serverProxy = createProxyMiddleware('/api', {
  target: 'https://zwljewelry.com/branddev',
  // target: 'http://192.168.3.167:8081',
  changeOrigin: true,
  pathRewrite: {
    '^/api': ''
  },
  logLevel: 'debug'
})

function cleanJs() {
  return del([config.destDir + '/js'])
}

function cleanJsMap() {
  return src(config.distDir + '/js/*.map')
    .pipe(vinylPaths(del))
}

function ES6ToES5() {
  return src(config.srcDir + '/js/**/*.js')
    .pipe(preprocess({
      context: {
        NODE_ENV: process.env.NODE_ENV.trim() || 'development'
      }
    }))
    .pipe(babel({
      presets: ['@babel/preset-env']
    }))
    .pipe(dest(config.destDir + '/js'))
}

function bundleJs(name) {
  return browserify({
    entries: config.destDir + '/js/' + name,
    debug: true
  })
    .bundle()
    .on('error', function (error) {
      console.log('error', error.toString())
    })
    .pipe(stream(name))
    .pipe(buffer())
    .pipe(dest(config.destDir + '/js'))
}

function moduleJs() {
  return src(config.destDir + '/js/*.js')
    .pipe(ignore.exclude(function (file) {
      var name = file.history[0].replace(file.base, '')
      name = name.replace(/\\/, '')
      bundleJs(name)
    }))
    .on('error', function (e) {
      console.log(e)
    })
}

function buildJs() {
  return src(config.destDir + '/js/*.js')
    .pipe(uglify())
    .pipe(dest(config.distDir + '/js'))
}

function cleanCss() {
  return del([config.destDir + '/css'])
}

function sass2css() {
  return src(config.srcDir + '/sass/*.scss')
    .pipe(sass())
    .pipe(postcss([autoprefixer({
      // 兼容主流浏览器的最新两个版本
      browsers: ['last 2 Chrome versions', 'safari 5', 'ios 7', 'android 4'],
      // 是否美化属性值
      cascade: true
    })]))
    .pipe(dest(config.destDir + '/css'))
}

function buildCss() {
  return src(config.destDir + '/css/*.css')
    .pipe(cleancss())
    .pipe(dest(config.distDir + '/css'))
}

function cleanHtml() {
  return del([config.destDir + '/*.html'])
}

function composeHtml() {
  return src(config.srcDir + '/*.html')
    .pipe(htmltpl({
      tag: 'template',
      paths: [config.srcDir + '/part'],
      engine: function (template, data) {
        return template && artTemplate.compile(template)(data)
      },
      data: {
        useHeader: false
      },
      beautify: {
        indent_char: ' ',
        indent_with_tabs: false
      }
    }))
    .pipe(dest(config.destDir))
}

function buildHtml() {
  return src(config.destDir + '/*.html')
    .pipe(htmlmin({
      removeComments: true, //清除HTML注释
      collapseWhitespace: true, //压缩HTML
      collapseBooleanAttributes: true, //省略布尔属性的值 <input checked="true"/> ==> <input />
      removeEmptyAttributes: true, //删除所有空格作属性值 <input id="" /> ==> <input />
      removeScriptTypeAttributes: true, //删除<script>的type="text/javascript"
      removeStyleLinkTypeAttributes: true, //删除<style>和<link>的type="text/css"
    }))
    .pipe(dest(config.distDir))
}

function cleanStatic() {
  return del(config.destDir + '/static')
}

function removeStatic() {
  return src(config.srcDir + '/static/**')
    .pipe(dest(config.destDir + '/static'))
}

function buildStatic() {
  return src(config.destDir + '/static/**')
    .pipe(dest(config.distDir + '/static'))
}

function cleanDist() {
  return del([config.distDir])
}

function server(cb) {
  browserSync.init({
    notify: false,
    server: {
      baseDir: config.destDir + '/',
      middleware: [serverProxy]
    },
    open: 'external'
  })
  cb()
}

function monitorSrcOrigin(cb) {
  watch(config.srcDir + '/js/**', series(cleanJs, ES6ToES5, moduleJs))
  watch(config.srcDir + '/sass/**', series(cleanCss, sass2css))
  watch(config.srcDir + '/part/**', series(cleanHtml, composeHtml))
  watch(config.srcDir + '/*.html', series(cleanHtml, composeHtml))
  watch(config.srcDir + '/static/**', series(cleanStatic, removeStatic))
  watch(config.destDir + '/**', { delay: 300 }, function (cb) {
    browserSync.reload()
    cb()
  })
  cb()
}

exports.cleanJsMap = cleanJsMap
exports.dev = series(
  series(cleanJs, ES6ToES5, moduleJs),
  series(cleanCss, sass2css),
  series(cleanHtml, composeHtml),
  series(cleanStatic, removeStatic)
)
exports.server = series(server, monitorSrcOrigin)
exports.build = series(cleanDist, parallel(buildJs, buildCss, buildHtml, buildStatic))
