/** Every selected channel is required; text searches names, services and declared brands. */
export function matchesDistribution(company, distribution, filters, categories = {}) {
 if(!distribution)return false;
 const text=[company.company,company.name,company.about,...company.offers,...distribution.brands,...distribution.categories.map(k=>categories[k])].join(' ').toLocaleLowerCase();
 return (filters.query||'').toLocaleLowerCase().split(/\s+/).every(t=>text.includes(t))
  && (!filters.product||distribution.categories.includes(filters.product))
  && (!filters.channels||filters.channels.split(',').every(v=>distribution.channels.includes(v)))
  && (!filters.warehouse||distribution.warehouse==='own')
  && (!filters.transport||distribution.transport==='own')
  && (!filters.cold||distribution.coldChain);
}
