import { FormLayout } from "../../ui/FormLayout";

export function PostRequestSkeleton() {
  return <div className="post-page" aria-busy="true" aria-label="მოთხოვნის ფორმის ჩატვირთვა">
    <FormLayout title="დეტალები"
      steps={<div className="post-steps" aria-hidden="true"><span className="ma-skel ma-skel--pills" /></div>}
      asideLabel="ასე ჩანს" aside={<span aria-hidden="true" className="ma-skel ma-skel--block" />}
    >
      <section className="post-card" aria-hidden="true"><span className="ma-skel ma-skel--title" /><div className="post-card__body">
        <div className="post-fields"><span className="ma-skel ma-skel--search" /><span className="ma-skel ma-skel--search" /></div>
        <span className="ma-skel ma-skel--block" /><span className="ma-skel ma-skel--search ma-skel--w40" />
      </div></section>
    </FormLayout>
  </div>;
}
