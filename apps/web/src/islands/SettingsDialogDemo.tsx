import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export default function SettingsDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open example dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reusable dialog"
        description="A component from the design system."
        footer={<Button onClick={() => setOpen(false)}>Got it</Button>}
      >
        <p>This dialog closes on Escape, backdrop click, or the button above.</p>
      </Dialog>
    </>
  );
}
