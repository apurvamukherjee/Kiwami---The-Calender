import type { ModalProps } from "antd";
import { Modal } from "antd";
import { useIsMobile } from "../hooks/useIsMobile";

// Drop-in replacement for antd Modal: a centered dialog (sensible fixed
// width — dialogs stay dialog-sized even on a wide desktop monitor) on
// desktop/tablet, a full-width bottom sheet on phone widths.
export function Sheet(props: ModalProps) {
  const isMobile = useIsMobile();
  if (!isMobile) return <Modal width={480} {...props} />;
  return (
    <Modal
      {...props}
      centered={false}
      style={{ top: "auto", margin: 0, padding: 0, maxWidth: "100vw", ...props.style }}
      wrapClassName={`kiwami-bottom-sheet ${props.wrapClassName ?? ""}`.trim()}
      styles={{
        ...(props.styles ?? {}),
        content: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          paddingBottom: "env(safe-area-inset-bottom)",
          ...(props.styles?.content ?? {}),
        },
      }}
    />
  );
}
