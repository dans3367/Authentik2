import { DefaultRootProps } from "@puckeditor/core";

export type RootProps = DefaultRootProps;

export const Root = {
  defaultProps: {
    title: "My Newsletter",
  },
  render: ({ puck: { renderDropZone: DropZone } }: any) => {
    return (
      <div
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <DropZone zone="default-zone" style={{ flexGrow: 1 }} />
      </div>
    );
  },
};

export default Root;
