import { Vector2d } from 'konva/lib/types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Group } from 'react-konva';
import Icon from '../../assets/zone/exaflare.svg?react';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { LayerName } from '../../render/layers';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { ExaflareZone, ObjectType } from '../../scene';
import { CENTER_DOT_RADIUS, DEFAULT_AOE_COLOR, DEFAULT_AOE_OPACITY, panelVars } from '../../theme';
import { usePanelDrag } from '../../usePanelDrag';
import { HideGroup } from '../HideGroup';
import { useHighlightProps } from '../highlight';
import { PrefabIcon } from '../PrefabIcon';
import { RadiusObjectContainer } from '../RadiusObjectContainer';
import { EXAFLARE_SPACING_DEFAULT } from './constants';
import { normalizeExaflareStep } from './exaflareStep';
import { ChevronTail } from './shapes';
import { getArrowStyle, getZoneStyle } from './style';

const DEFAULT_RADIUS = 50;
const DEFAULT_LENGTH = 6;
const DEFAULT_STEP_SIZE = 1;
const DEFAULT_STEP_POSITION = 0;

export const ZoneExaflare: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();

    return (
        <PrefabIcon
            draggable
            name={t('objects.exaflare', { defaultValue: 'Moving AOE' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.Exaflare,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<ExaflareZone>(ObjectType.Exaflare, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Exaflare,
            color: DEFAULT_AOE_COLOR,
            opacity: DEFAULT_AOE_OPACITY,
            radius: DEFAULT_RADIUS,
            length: DEFAULT_LENGTH,
            spacing: EXAFLARE_SPACING_DEFAULT,
            showLengthDash: true,
            stepSize: DEFAULT_STEP_SIZE,
            stepPosition: DEFAULT_STEP_POSITION,
            rotation: 0,
            ...object,
            ...position,
        },
    };
});

const ARROW_W_FRAC = 0.8;
const ARROW_H_FRAC = 0.5;

function getTrailIndices(length: number): number[] {
    const len = Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;
    if (len <= 0) return [];
    return Array.from({ length: len }).map((_, i) => i);
}

function getTrailPoint(radius: number, spacing: number, index: number): Vector2d {
    return {
        x: 0,
        y: -((radius * 2 * spacing) / 100) * index,
    };
}

function getDashSize(radius: number) {
    return (2 * Math.PI * radius) / 32;
}

interface ExaflareRendererProps extends RendererProps<ExaflareZone> {
    radius: number;
    rotation: number;
    isDragging?: boolean;
}

const ExaflareRenderer: React.FC<ExaflareRendererProps> = ({ object, radius, rotation, isDragging }) => {
    const highlightProps = useHighlightProps(object);
    const style = getZoneStyle(object.color, object.opacity, radius * 2);

    const arrow = getArrowStyle(object.color, object.opacity * 3);
    const showLengthDash = object.showLengthDash ?? true;
    const trailIndices = getTrailIndices(object.length);
    const dashSize = getDashSize(radius);
    const step = normalizeExaflareStep(object.length, object.stepSize, object.stepPosition);
    const baseActive = 0 >= step.start && 0 < step.end;
    const arrowIndex = Math.max(0, step.start);
    const arrowPoint =
        object.length > 0 && arrowIndex >= 0 && arrowIndex < object.length
            ? getTrailPoint(radius, object.spacing, arrowIndex)
            : null;
    const hitStrokeWidth = 16;

    return (
        <>
            <Group rotation={rotation}>
                <HideGroup>
                    {trailIndices.map((index) => {
                        if (index === 0) return null;
                        const active = index >= step.start && index < step.end;
                        if (!active && !showLengthDash) return null;

                        const point = getTrailPoint(radius, object.spacing, index);
                        if (active) {
                            return (
                                <Circle
                                    key={index}
                                    radius={radius}
                                    {...point}
                                    {...style}
                                    hitStrokeWidth={hitStrokeWidth}
                                />
                            );
                        }

                        return (
                            <Circle
                                key={index}
                                radius={radius}
                                {...point}
                                {...style}
                                fillEnabled={false}
                                dash={[dashSize, dashSize]}
                                dashOffset={dashSize / 2}
                                opacity={0.5}
                                hitStrokeWidth={hitStrokeWidth}
                            />
                        );
                    })}
                </HideGroup>

                {highlightProps && <Circle radius={radius + style.strokeWidth / 2} {...highlightProps} />}

                <HideGroup>
                    {baseActive ? (
                        <Circle radius={radius} {...style} hitStrokeWidth={hitStrokeWidth} />
                    ) : showLengthDash ? (
                        <Circle
                            radius={radius}
                            {...style}
                            fillEnabled={false}
                            dash={[dashSize, dashSize]}
                            dashOffset={dashSize / 2}
                            opacity={0.5}
                            hitStrokeWidth={hitStrokeWidth}
                        />
                    ) : null}
                    {arrowPoint && (
                        <ChevronTail
                            x={arrowPoint.x}
                            y={arrowPoint.y - radius * ARROW_H_FRAC * 0.9}
                            width={radius * ARROW_W_FRAC}
                            height={radius * ARROW_H_FRAC}
                            {...arrow}
                        />
                    )}

                    {isDragging && (
                        <Circle
                            x={arrowPoint?.x ?? 0}
                            y={arrowPoint?.y ?? 0}
                            radius={CENTER_DOT_RADIUS}
                            fill={style.stroke}
                        />
                    )}
                </HideGroup>
            </Group>
        </>
    );
};

const ExaflareContainer: React.FC<RendererProps<ExaflareZone>> = ({ object }) => {
    // TODO: add control point for trail length
    return (
        <RadiusObjectContainer object={object} allowRotate>
            {(props) => <ExaflareRenderer object={object} {...props} />}
        </RadiusObjectContainer>
    );
};

registerRenderer<ExaflareZone>(ObjectType.Exaflare, LayerName.Ground, ExaflareContainer);

const ExaflareDetails: React.FC<ListComponentProps<ExaflareZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.exaflare', { defaultValue: 'Moving AOE' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<ExaflareZone>(ObjectType.Exaflare, ExaflareDetails);
