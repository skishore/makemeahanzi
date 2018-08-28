#!/usr/bin/env node

const TEST_MODE=false // set true to only generate 3 svgs and save them in ./
if (TEST_MODE) { var a = 0 }

const fs = require('fs-extra')
const readline = require('readline')
const cheerio = require('cheerio')

const newCss = `
    <style type="text/css">
        .stroke1 {fill: #BF0909;}
        .stroke2 {fill: #BFBF09;}
        .stroke3 {fill: #09BF09;}
        .stroke4 {fill: #09BFBF;}
        .stroke5 {fill: #0909BF;}
        .stroke6 {fill: #BF09BF;}
        .stroke7 {fill: #42005e;}
        .stroke8 {fill: #ff3333;}
        .stroke9 {fill: #BFBFBF;}
        .stroke10 {fill: #00a53f;}
        .stroke11 {fill: #fff000;}
        .stroke12 {fill: #6600a5;}
        .stroke13 {fill: #0053a5;}
        .stroke14 {fill: #62c22b;}
        .stroke15 {fill: #BF09BF;}
        .stroke16 {fill: #BF0909;}
        .stroke17 {fill: #BFBF09;}
        .stroke18 {fill: #09BF09;}
        .stroke19 {fill: #09BFBF;}
        .stroke20 {fill: #0909BF;}
        text {
            font-family: Helvetica;
            font-size: 50px;
            fill: #FFFFFF;
            paint-order: stroke;
            stroke: #000000;
            stroke-width: 4px;
            stroke-linecap: butt;
            stroke-linejoin: miter;
            font-weight: 800;
        }
    </style>
`

const lineReader = readline.createInterface({
    input: fs.createReadStream('../graphics.txt')
})

lineReader.on('line', line => {
    if (TEST_MODE) { if (a<3) {a++} else {return} }
    const item = JSON.parse(line)
    const charCode = item.character.charCodeAt()
    const startingPoints = item.medians.map(i=>({x:i[0][0],y:i[0][1]}))
    fs.readFile(`../svgs/${charCode}.svg`, 'utf8').then(svgStr => {
        const $ = cheerio.load(svgStr)
        let pathEls = $('g:nth-of-type(2) > path[fill="lightgray"]')
        //pathEls.removeAttr('fill')
        pathEls.each((i, el) => {
            $(el).removeAttr('fill')
            $(el).addClass(`stroke${i+1}`)
        })
        let pathes = $.html(pathEls).replace(/<path/g,'\n    <path')
        let texts = ''
        for (let i=0; i<pathEls.length; i++) {
            texts += `\n    <text x="${startingPoints[i].x}" y="${startingPoints[i].y}" style="transform-origin:${startingPoints[i].x}px ${startingPoints[i].y}px; transform:scale(1,-1);">${i+1}</text>`
        }
        $('g:nth-of-type(2)').html(`${newCss}${pathes}${texts}`)
        const textEls = $('text')

        const newSvgStr = $.html($('svg'))
        if (!TEST_MODE) {
            fs.writeFile(`../svgs-still/${charCode}-still.svg`, newSvgStr).then(() => {
                console.log(`../svgs-still/${charCode}-still.svg written`)
            })
        } else {
            fs.writeFile(`./${charCode}-still.svg`, newSvgStr).then(() => {
                console.log(`./${charCode}-still.svg written`)
            })
        }
    }).catch(console.error)
})
