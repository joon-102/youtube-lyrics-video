const perhooks = require('node:perf_hooks');
const fs = require('fs-extra');

const cliProgress = require('cli-progress');
const fetch = require('node-fetch');
const sharp = require('sharp');

function generateSvgBuffer(weight: number, height: number, fontWeight: number, fontSize: number, text: string , color : string  = 'white'): Buffer {
    let font: string = 'GmarketSansMedium';
    const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
        .replace('"', "");

    if (text == "♪") { font = 'Pretendard'; };

    return Buffer.from(`
        <svg width="${weight}" height="${height}" viewBox="0 0 ${weight - 10} ${height - 10}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>
                    .title { 
                        word-spacing: 0.1px; 
                        font-family: '${font}'; 
                        font-weight: ${fontWeight}; 
                        font-size: ${fontSize}px; 
                        fill: ${color}; 
                    } 
                </style>
            </defs>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" class="title">${escapedText}</text>
        </svg>
    `);
}

function getLyricsSize(text: string): number {
    if (text === "♪") {
        return 100;
    }

    const sizeMap = [
        { length: 60, size: 38 },
        { length: 55, size: 42 },
        { length: 44, size: 48 },
        { length: 34, size: 57 },
        { length: 24, size: 62 },
        { length: 15, size: 68 },
    ];

    let lyricsSize = 71; 

    for (const item of sizeMap) {
        if (text.length >= item.length) {
            lyricsSize = item.size;
            break;
        }
    }

    return lyricsSize;
}


export async function BasicImage(generateFixedValue: any, Search: any): Promise<void> {

    const progressBar = new cliProgress.SingleBar({
        format: `{status} |{bar}| {percentage}% | {value}/{total} Chunks `,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
    }, cliProgress.Presets.shades_classic);

    const start = perhooks.performance.now();
    progressBar.start(3, 0, { status: "기본 이미지 생성을 시작합니다...", speed: "N/A" });

    progressBar.update(1, { status: '이미지 다운로드 중...' });
    const response = await fetch(Search.image);
    if (!response.ok) throw new Error(`이미지 다운로드 실패 : ${response.statusText}`);
    const buffer = await response.buffer();

    progressBar.update(2, { status: '앨범 커버 생성 중...' });
    const Album_Cover = await sharp(buffer)
        .resize(generateFixedValue.album_cover.width, generateFixedValue.album_cover.height)
        .composite([{
            input: Buffer.from(
                `<svg width="${generateFixedValue.album_cover.width}" height="${generateFixedValue.album_cover.height}">
                    <rect x="0" y="0" width="${generateFixedValue.album_cover.width}" height="${generateFixedValue.album_cover.height}" rx="${generateFixedValue.album_cover.round}" ry="${generateFixedValue.album_cover.round}" fill="black"/>
                </svg>`
            ), blend: 'dest-in'
        }])
        .toFormat('png')
        .toBuffer();

    progressBar.update(3, { status: '백그라운드 사진 합성 중...' });
    const Background_photo = await sharp(buffer)
        .resize(generateFixedValue.background_photo.width, generateFixedValue.background_photo.height)
        .modulate({
            brightness: generateFixedValue.background_photo.brightness,
            saturation: generateFixedValue.background_photo.saturation
        })
        .sharpen()
        .blur(generateFixedValue.background_photo.blur)
        .flatten({ background: generateFixedValue.background_photo.flatten })
        .composite([
            {
                input: Buffer.from(
                    `<svg width="${generateFixedValue.background_photo.width}" height="${generateFixedValue.background_photo.height}">
                        <rect x="0" y="0" width="${generateFixedValue.background_photo.width}" height="${generateFixedValue.background_photo.height}" fill="rgba(0, 0, 0, ${generateFixedValue.background_photo.shadow})"/>
                    </svg>`
                ), blend: 'over'
            },
            {
                input: Album_Cover,
                left: Math.floor(generateFixedValue.background_photo.width / 4 - generateFixedValue.album_cover.width / 2),
                top: Math.floor((generateFixedValue.background_photo.height / 2) - (generateFixedValue.album_cover.height / 2)),
                blend: 'over'
            },
            {
                input: generateSvgBuffer(250, 100, 600, 35, 'BearMusic'),
                left: Math.floor(-4),
                top: Math.floor(-16.5),
                blend: 'over'
            }
        ])
        .toFormat('png')
        .toBuffer();



    let TitleSize: number = 85, ArtistSize: number = 60;

    const Title = generateSvgBuffer(2000, 1000, 900, TitleSize, Search.title);
    const Artist = generateSvgBuffer(2000, 1000, 300, ArtistSize, Search.artist);

    await sharp(Background_photo)
        .composite([
            {
                input: Title,
                left: Math.floor(generateFixedValue.background_photo.width / 3),
                top: Math.floor((generateFixedValue.background_photo.height / 2) - 950) + 65 - 30,
            },
            {
                input: Artist,
                left: Math.floor(generateFixedValue.background_photo.width / 3),
                top: Math.floor((generateFixedValue.background_photo.height / 2) - 950) + 95 + 65 - 30,
            }
        ])
        .toFile('temp/BasicImag.png');


    // await sharp(Background_photo)
    //     .composite([
    //         {
    //             input: Title,
    //             left: Math.floor(generateFixedValue.background_photo.width / 3),
    //             top: Math.floor((generateFixedValue.background_photo.height / 2) - 500) - 35 ,
    //         },
    //         {
    //             input: Artist,
    //             left: Math.floor(generateFixedValue.background_photo.width / 3),
    //             top: Math.floor((generateFixedValue.background_photo.height / 2) - 500) + 100 - 35,
    //         }
    //     ])
    //     .toFormat('png')
    //     .jpeg({ quality: 80 })
    //     .resize({ with : 80 })
    //     .toFile(`temp/Thumbnail.jpg`);

    progressBar.stop();

    const elapsedTime = ((perhooks.performance.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\x1B[1A\x1B[2K기본 이미지 생성 완료 , 소요시간 ${elapsedTime}초\n`)

}

export async function LyricsImage(generateFixedValue: any, lyrics: any): Promise<void> {
    const progressBar = new cliProgress.SingleBar({
        format: `{status} |{bar}| {percentage}% | {value}/{total} Chunks`,
    }, cliProgress.Presets.shades_classic);

    await fs.emptyDirSync('temp/lyrics');

    const start = perhooks.performance.now();
    progressBar.start(lyrics.length, 0, { status: '가사 이미지 합성 시작중...' });

    await sharp("temp/BasicImag.png")
        .composite([
            {
                input: generateSvgBuffer(1500, 1000, 600, 100, "♪"),
                left: Math.floor((generateFixedValue.background_photo.width / 4 + 1000 / 2) - 45 + 15),
                top: Math.floor(((generateFixedValue.background_photo.height) / 2) - 470 + 25)
            }
        ])
        .toFormat('png')
        .toFile(`temp/lyrics/0.png`);

    for (let index = 0; index < lyrics.length; index++) {
        const text = lyrics[index].words || "♪";
        const NextText = (lyrics[index + 1]?.words || "♪") || "";

        let lyricsSize: number = getLyricsSize(text);
        let nextSize:number = getLyricsSize(NextText) - 17;

        let composite = [
            {
                input: generateSvgBuffer(1500, 1000, 600, lyricsSize, text),
                left: Math.floor((generateFixedValue.background_photo.width / 4 + 1000 / 2) - 45 + 15),
                top: Math.floor(((generateFixedValue.background_photo.height) / 2) - 470 + 25)
            }
        ]

        if(lyrics[index + 1]) {
            composite.push({
                input: generateSvgBuffer(1500, 1000, 600, nextSize, NextText , '#A4A4A4'),
                left: Math.floor((generateFixedValue.background_photo.width / 4 + 1000 / 2) - 45 + 15),
                top: Math.floor(((generateFixedValue.background_photo.height) / 2) - 470 + 25 + 120)
            })
        }

        await sharp("temp/BasicImag.png")
            .composite(composite)
            .toFormat('png')
            .toFile(`temp/lyrics/${index + 1}.png`);

        progressBar.update(index + 1, { status: `${index + 1} 번째 이미지 합성 중...` });
    }

    progressBar.stop();
    process.stdout.write('\x1B[1A\x1B[2K');
    process.stdout.write(`가사 이미지 합성 완료 , 소요시간 ${((perhooks.performance.now() - start) / 1000).toFixed(1)}초\n`);
};
