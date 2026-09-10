const fs = require('fs');
const vm = require('vm');
const ctx = { location: { pathname: '/', search: '' } };
vm.createContext(ctx);
const app = fs.readFileSync('dist/app.js', 'utf8');
vm.runInContext(fs.readFileSync('dist/company-details.js', 'utf8') + '\n' + app.slice(0, app.indexOf('const grid=')), ctx);
const entries = vm.runInContext('Object.entries(filterOptions.industry).map(([id,title])=>({id,title,count:companies.filter(c=>c.industry===id).length}))', ctx);
const details = {
 textiles: ['package', 'თეთრეული და სასტუმროს ტექსტილი'],
 marketing: ['briefcase-business', 'ბრენდინგი, კონტენტი და დიზაინი'],
 logistics: ['truck', 'გადაზიდვა და დისტრიბუცია'],
 food: ['package', 'პროდუქტი კაფეებისა და რესტორნებისთვის'],
 packaging: ['package', 'ყუთები და ბრენდირებული შეფუთვა'],
 tourism: ['map-pin', 'სასტუმროები და ერთობლივი პაკეტები'],
 finance: ['clipboard-list', 'აღრიცხვა და ანგარიშგება']
};
const icon = name => `<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${name}"></use></svg>`;
const markup = `<!-- industry-directory:start -->
<section class="industry-section" id="industries" aria-labelledby="industry-heading">
 <div class="industry-layout">
  <div class="industry-intro">
   <span class="section-kicker">საქმიანობის მიმართულებები</span>
   <h2 id="industry-heading">იპოვე კომპანია<br>შენი სფეროდან</h2>
   <p>აირჩიე მიმართულება და გაეცანი შესაბამის შეთავაზებებს.</p>
   <img class="industry-sculpture" src="/assets/connection-sculpture.png" alt="" width="1536" height="1024" loading="lazy" decoding="async">
  </div>
  <div class="industry-directory">
   <ul class="industry-list">${entries.map(({id,title,count})=>`<li><a href="/categories/?industry=${id}"><span class="industry-icon">${icon(details[id][0])}</span><span class="industry-copy"><span class="industry-title tt">${title}</span><span class="industry-description">${details[id][1]}</span><span class="industry-count">${count} კომპანია</span></span>${icon('arrow-up-right')}</a></li>`).join('')}</ul>
   <p class="industry-demo">მიმართულებები სადემონსტრაციო კატალოგიდან</p>
  </div>
 </div>
</section>
<!-- industry-directory:end -->`;
const file = 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');
if (html.includes('<!-- industry-directory:start -->')) html = html.replace(/<!-- industry-directory:start -->[\s\S]*?<!-- industry-directory:end -->/, markup);
else html = html.replace('<section class="featured-section"', markup+'<section class="featured-section"');
fs.writeFileSync(file, html);
console.log('Generated '+entries.length+' industry links with company counts.');
