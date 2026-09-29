import { assert, rpc, go, login, logout, randomPassword } from '../lib.mjs';
export default async function(t) {
  await Promise.all(['client', 'company'].map(async (role, index) => {
    const p = await t.page();
    const account = { email: `e2e+${t.run}-${role}@meetany.local`, password: randomPassword() };
    t.emails.add(account.email);
    await t.step(`რეგისტრაცია / შესვლა / გასვლა: ${role}`, 'ახალი პროფილი შესაბამისი როლით; sign-out შემდეგ my_profile ცარიელია', async () => {
      await go(p, '/account/?tab=register');
      if (!await p.locator('#reg-name').count()) await p.locator('main').getByRole('button', { name: 'რეგისტრაცია', exact: true }).click();
      if (role === 'company') await p.getByLabel('ვთავაზობ მომსახურებას ან პროდუქციას', { exact: true }).check();
      await p.locator('#reg-name').fill('ნინო ბერიძე');
      await p.locator('#reg-company').fill(`მიწოდების ჯგუფი ${t.marker}`);
      await p.locator('#reg-phone').fill('+995 5' + (Number(t.run.replace(/\D/g, '').slice(-8)) + index).toString().padStart(8, '0').slice(-8));
      await p.locator('#reg-email').fill(account.email);
      if (role === 'company') await p.locator('#reg-industry + select').selectOption('furniture');
      await p.locator('#reg-password').fill(account.password);
      await p.locator('#reg-terms').check();
      await p.locator('main form button[type="submit"]').click();
      await p.locator('#reg-name').waitFor({ state: 'hidden', timeout: 18000 });
      const me = (await rpc(p, 'my_profile'))[0];
      assert.equal(me?.role, role, 'verification off: რეგისტრაცია აქტიურ პროფილამდე უნდა მიდიოდეს');
      assert.equal(me.email, account.email);
      await logout(p); await login(p, account); await logout(p);
    }, p);
  }));
  const p = await t.page();
  await t.step('პაროლის აღდგენა: ვალიდაცია, კოდი, შეცდომა', 'არასწორი ელფოსტა/ცარიელი კოდი ქართულად; არასწორი კოდი უარყოფილია', async () => {
    await go(p, '/account/'); await p.getByRole('button', { name: 'პაროლი დაგავიწყდა?' }).click();
    await p.locator('main form button[type="submit"], main .auth-submit button').click();
    assert((await p.locator('main').innerText()).includes('ჩაწერე სწორი ელფოსტა'));
    await p.locator('#reset-email').fill(`e2e+${t.run}-client@meetany.local`);
    await p.getByRole('button', { name: 'კოდის მიღება', exact: true }).click();
    await p.locator('#reset-code').waitFor();
    await p.getByRole('button', { name: 'დადასტურება', exact: true }).click();
    assert((await p.locator('main').innerText()).includes('ჩაწერე ელფოსტით მიღებული კოდი'));
    await p.locator('#reset-code').fill('INVALID');
    await p.locator('#reset-password').fill(randomPassword());
    await p.getByRole('button', { name: 'დადასტურება', exact: true }).click();
    await p.locator('.auth-alert').filter({ hasText: 'კოდი არასწორია ან ვადაგასულია' }).waitFor();
    return { limitation: 'რეალური OTP-ის მიღება/წარმატებული reset ელფოსტის გარეშე არ შემოწმებულა' };
  }, p);
}
