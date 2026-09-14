import fs from 'node:fs/promises';
await fs.mkdir('public/assets/fonts', { recursive: true });
for (const [family, file] of [
  ['Montserrat:wght@400;700', 'montserrat'],
  ['Poppins:wght@400;700', 'poppins'],
  ['Questrial', 'questrial'],
  ['Nanum+Pen+Script', 'nanum-pen-script'],
]) {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
  ).text();
  const urls = [...css.matchAll(/url\((https[^)]+)\)/g)].map((x) => x[1]);
  for (const [index, url] of urls.entries()) {
    const data = await (await fetch(url)).arrayBuffer();
    await fs.writeFile(`public/assets/fonts/${file}-${index}.ttf`, Buffer.from(data));
  }
  console.log(file, urls.length, css);
}
