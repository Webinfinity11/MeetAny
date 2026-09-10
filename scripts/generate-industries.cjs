const fs = require('fs');
const vm = require('vm');
const ctx = { location: { pathname: '/', search: '' } };
vm.createContext(ctx);
const app = fs.readFileSync('dist/app.js', 'utf8');
vm.runInContext(fs.readFileSync('dist/company-details.js', 'utf8') + '\n' + app.slice(0, app.indexOf('const grid=')), ctx);
const entries = vm.runInContext('Object.entries(filterOptions.industry).map(([id,title])=>({id,title,count:companies.filter(c=>c.industry===id).length}))', ctx);
const details = {
 textiles: ['shirt', 'თეთრეული და სასტუმროს ტექსტილი'],
 marketing: ['megaphone', 'ბრენდინგი, კონტენტი და დიზაინი'],
 logistics: ['truck', 'გადაზიდვა და დისტრიბუცია'],
 food: ['utensils', 'პროდუქტი კაფეებისა და რესტორნებისთვის'],
 packaging: ['package', 'ყუთები და ბრენდირებული შეფუთვა'],
 tourism: ['map-pin', 'სასტუმროები და ერთობლივი პაკეტები'],
 finance: ['calculator', 'აღრიცხვა და ანგარიშგება']
};
const icon = name => `<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg?v=category-symbols#${name}"></use></svg>`;
const shortTitles = {textiles:'ტექსტილი',marketing:'მარკეტინგი',logistics:'ლოგისტიკა',food:'საკვები',packaging:'შეფუთვა',tourism:'ტურიზმი',finance:'ფინანსები'};
const markup = `<!-- industry-directory:start -->
<section class="industry-section" id="industries" aria-labelledby="industry-heading">
 <div class="industry-heading-row"><h2 id="industry-heading">საქმიანობის მიხედვით</h2><span>სადემონსტრაციო კატალოგი</span></div>
 <ul class="industry-list">${entries.map(({id,title,count})=>`<li><a href="/categories/?industry=${id}" aria-label="${title} — ${count} კომპანია"><span class="industry-icon">${icon(details[id][0])}</span><span class="industry-title tt">${shortTitles[id]}</span><span class="industry-count">${count} კომპანია</span></a></li>`).join('')}</ul>
</section>
<!-- industry-directory:end -->`;
const file = 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');
if (html.includes('<!-- industry-directory:start -->')) html = html.replace(/<!-- industry-directory:start -->[\s\S]*?<!-- industry-directory:end -->/, markup);
else html = html.replace('<section class="featured-section"', markup+'<section class="featured-section"');
fs.writeFileSync(file, html);
console.log('Generated '+entries.length+' industry links with company counts.');
