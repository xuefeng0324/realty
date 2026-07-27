const fs = require('fs');
const c = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
// 检查这 4 张卡的 computed/函数在 dashboard 还有哪些引用
for (const k of ['bedroomArea','orientationFloor','decorateAge','scatter','baMaxCount','SCATTER_W','SCATTER_H','ofCellLabel','daCellClass','scatterImproveCohort','scatterValueDip','reloadBedroomArea','reloadOrientationFloor','reloadDecorateAge','reloadScatter','bedroomArea.cellClass','orientationFloor.cellClass','decorateAge.cellClass','scatter.cellClass']) {
  let count = 0;
  let pos = -1;
  while ((pos = c.indexOf(k, pos + 1)) !== -1) count++;
  console.log(k + ': ' + count);
}