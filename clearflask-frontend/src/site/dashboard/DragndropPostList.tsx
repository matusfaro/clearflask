// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import DragmeIcon from '@material-ui/icons/DragIndicator';
import classNames from 'classnames';
import React from 'react';
import { Draggable, DraggableProvided, DropAnimation, Droppable, DroppableId, DroppableProvidedProps } from 'react-beautiful-dnd';
import { Provider, useStore } from 'react-redux';
import ServerAdmin from '../../api/serverAdmin';
import { TourAnchor } from '../../common/tour';
import { customReactMemoEquals } from '../../common/util/reactUtil';
import { droppableDataDeserialize } from './dashboardDndActionHandler';
import PostList, { DashboardListPostSpacing } from './PostList';

export const PostListWithSearchKeyDroppableIdPrefix = 'post-list-';

const styles = (theme: Theme) => createStyles({
  droppable: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    width: 600,
    // This is a contested line:
    // - Height of 100% ensures active drag doesnt cause weird truncation
    // - Height of 100% is incorrect as (at least in the Dashboard Roadmap)
    //   there is a neighbour title so 100% is actually overflows and scrolls
    minHeight: '100%',
    maxWidth: '100%',
  },
  draggable: {
    position: 'relative', // For DragmeIcon
  },
  dragmeIconContainer: {
    position: 'absolute',
    top: theme.spacing(4),
    left: 0,
    cursor: 'grab',
    opacity: 0.1,
    marginRight: theme.spacing(4),
    height: 30,
  },
  dragmeIconContainerDragging: {
    opacity: 1,
  },
});
const useStyles = makeStyles(styles);

// Optimization to not re-render children during dragging
const DragndropPostList = React.memo((props: {
  droppable?: boolean;
  droppableId: string;
  dragSelectedTourAnchorProps?: React.ComponentProps<typeof TourAnchor>;
} & React.ComponentProps<typeof PostList>) => {
  const { droppable, droppableId, ...PostListProps } = props;
  return (
    <Droppable droppableId={droppableId} isDropDisabled={!droppable}>
      {(providedDroppable, snapshotDroppable) => (
        <>
          <DragndropPostListDroppableInner
            providedDroppableInnerRef={providedDroppable.innerRef}
            PostListProps={PostListProps}
            DroppableProvidedProps={providedDroppable.droppableProps}
            dragSelectedTourAnchorProps={props.dragSelectedTourAnchorProps}
          />
          {providedDroppable.placeholder && (<div style={{ display: 'none' }}>{providedDroppable.placeholder}</div>)}
        </>
      )}
    </Droppable>
  );
}, customReactMemoEquals({ nested: new Set(['dragSelectedTourAnchorProps', 'PostListProps', 'DroppableProvidedProps']) }));
DragndropPostList.displayName = 'DragndropPostList';
export default DragndropPostList;

// Optimization to not re-render children during dragging
const DragndropPostListDroppableInner = React.memo((props: {
  providedDroppableInnerRef;
  PostListProps: React.ComponentProps<typeof PostList>;
  DroppableProvidedProps: DroppableProvidedProps;
  dragSelectedTourAnchorProps?: React.ComponentProps<typeof TourAnchor>;
}) => {
  const classes = useStyles();
  return (
    <div
      className={classNames(
        classes.droppable,
      )}
      ref={props.providedDroppableInnerRef}
      {...props.DroppableProvidedProps}
    >
      <DragndropPostListPostListInner
        PostListProps={props.PostListProps}
        dragSelectedTourAnchorProps={props.dragSelectedTourAnchorProps}
      />
    </div>
  );
}, customReactMemoEquals({ nested: new Set(['dragSelectedTourAnchorProps', 'PostListProps', 'DroppableProvidedProps']) }));
DragndropPostListDroppableInner.displayName = 'DragndropPostListDroppableInner';

var lastSelectedId: string | undefined;
// Optimization to not re-render children during dragging
const DragndropPostListPostListInner = React.memo((props: {
  PostListProps: React.ComponentProps<typeof PostList>;
  dragSelectedTourAnchorProps?: React.ComponentProps<typeof TourAnchor>;
}) => {
  const theme = useTheme();
  const store = useStore();
  return (
    <PostList
      {...props.PostListProps}
      PanelPostProps={{
        margins: theme.spacing(DashboardListPostSpacing, DashboardListPostSpacing, DashboardListPostSpacing, DashboardListPostSpacing + 1),
        ...props.PostListProps.PanelPostProps,
        wrapPost: (post, content, index) => (
          <Draggable
            draggableId={post.ideaId}
            index={index}
          >
            {(providedDraggable, snapshotDraggable) => {
              var inner = content;
              if (props.dragSelectedTourAnchorProps) {
                if (!!props.PostListProps.selected && lastSelectedId !== props.PostListProps.selected) {
                  lastSelectedId = props.PostListProps.selected;
                }
                if (lastSelectedId === post.ideaId) {
                  inner = (
                    <Provider store={ServerAdmin.get().getStore()}>
                      <TourAnchor placement='top' {...props.dragSelectedTourAnchorProps} zIndex={zb => zb.modal - 1}>
                        <Provider store={store}>
                          {inner}
                        </Provider>
                      </TourAnchor>
                    </Provider>
                  );
                }
              }
              inner = (
                <DragndropPostListDraggableInner
                  providedDraggable={providedDraggable}
                  isDragging={snapshotDraggable.isDragging}
                  draggingOver={snapshotDraggable.draggingOver}
                  dropAnimation={snapshotDraggable.dropAnimation}
                  content={inner}
                />
              );
              return inner as any;
            }}
          </Draggable>
        ),
      }}
    />
  );
}, customReactMemoEquals({ nested: new Set(['dragSelectedTourAnchorProps', 'PostListProps']) }));
DragndropPostListPostListInner.displayName = 'DragndropPostListPostListInner';

// Optimization to not re-render children during dragging
const DragndropPostListDraggableInner = React.memo((props: {
  providedDraggable: DraggableProvided;
  isDragging: boolean;
  draggingOver?: DroppableId;
  dropAnimation?: DropAnimation;
  content: React.ReactNode;
}) => {
  const classes = useStyles();
  const theme = useTheme();
  return (
    <div
      ref={props.providedDraggable.innerRef}
      {...props.providedDraggable.draggableProps}
      {...props.providedDraggable.dragHandleProps}
      style={patchStyle(theme, props.providedDraggable, props.draggingOver, props.dropAnimation)}
      className={classes.draggable}
    >
      <div className={classNames(
        classes.dragmeIconContainer,
        props.isDragging && classes.dragmeIconContainerDragging,
      )}>
        <DragmeIcon color='inherit' />
      </div>
      {props.content}
    </div>
  );
});
DragndropPostListDraggableInner.displayName = 'DragndropPostListDraggableInner';

const patchStyle = (
  theme: Theme,
  providedDraggable: DraggableProvided,
  draggingOver?: DroppableId,
  dropAnimation?: DropAnimation,
) => {
  const style: any = {
    ...(providedDraggable.draggableProps.style || {}),
  };

  if (draggingOver || dropAnimation) {
    style.zIndex = theme.zIndex.tooltip + 1;
  }

  // Animate dropping into quick action droppable as if it was a combine
  // by changing opacity and scale down.
  if (dropAnimation
    && style.transform
    && draggingOver
    && droppableDataDeserialize(draggingOver)?.['dropbox']) {
    // Properties match default combine https://github.com/atlassian/react-beautiful-dnd/blob/2360665305b854434e968e41c7b4105009b73c40/src/animation.js#L18
    style.transform = (style.transform || '') + ' scale(0)';
    style.opacity = 0;
  }

  return style;
}
