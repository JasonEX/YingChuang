// Actual canvas supplied from https://twkan.com/txt/85206/49880572.
// It contains narrative text between two ordinary paragraphs, not an advertisement.
const chapterTwoCanvasHtml = `<canvas class="sec-last"
  data-c="dWhpZio6dGVqJiNutO+Tuciu95Ge5MqAt8n3tJ7euefW8Lba57vfsNPV"
  data-v="9dad33b214164e75" width="1408" height="80"
  style="width:704px;height:40px;display:block"></canvas>`;

// Synthetic sample also covers entities, multiple lines, and existing watermark cleanup.
const syntheticCanvasHtml = `<canvas class="sec-last" width="2040" height="128"
  style="width:1020px;height:64px;display:block" data-v="fixture-v1"
  data-c="6LuL4IfevL/ttpiR+cv897DE7tn0sdPX84qCrsCL64G24afNs4Pqt4KO+v7C+4zKDX44LXGloJTj590la3QmJTohOG97cOONlKLGs+P0i7zs/6PfivW/8qK+veOdhxaj1Yml2ILupu6graqum9Ox1sGmrJDu/PDkkIvyuZCo/pSmxKvskMShhKCvrMG92MGlk4/lydA="></canvas>`;

export const twkanCanvasLines = [
  '他是真的知曉今後事。',
  '他回頭望去，遠處的燈火仍未熄滅。',
  '<約定> & 燈火，並非幻影。',
];
export const twkanCanvasHtml = `${chapterTwoCanvasHtml}<br><br>${syntheticCanvasHtml}`;
