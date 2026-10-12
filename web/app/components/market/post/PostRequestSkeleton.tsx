export function PostRequestSkeleton() {
  return <div className="post-page" aria-busy="true" aria-label="მოთხოვნის ფორმის ჩატვირთვა">
    <header className="post-heading"><h1>მოთხოვნის განთავსება</h1></header>
    <div aria-hidden="true">
      <div className="post-steps"><span className="ma-skel ma-skel--pills" /></div>
      <div className="post-layout"><section className="post-card"><span className="ma-skel ma-skel--title" /><div className="post-card__body">
        <div className="post-fields"><span className="ma-skel ma-skel--search" /><span className="ma-skel ma-skel--search" /></div>
        <span className="ma-skel ma-skel--block" /><span className="ma-skel ma-skel--search ma-skel--w40" />
      </div></section></div>
    </div>
  </div>;
}
