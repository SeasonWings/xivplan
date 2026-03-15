import { Tab, TabList, Text } from '@fluentui/react-components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HotkeyName } from '../HotkeyName';
import { MarkerArrow } from '../prefabs/Arrow';
import { EnemyCircle, EnemyHuge, EnemyLarge, EnemyMedium, EnemySmall } from '../prefabs/Enemies';
import { Waymark1, Waymark2, Waymark3, Waymark4, WaymarkA, WaymarkB, WaymarkC, WaymarkD } from '../prefabs/Markers';
import {
    PartyAny,
    PartyAstrologian,
    PartyBard,
    PartyBlackMage,
    PartyBlueMage,
    PartyDancer,
    PartyDarkKnight,
    PartyDps,
    PartyDragoon,
    PartyFenXiangGu,
    PartyFenXiangYan,
    PartyFenXiangZhou,
    PartyGuiWangGang,
    PartyGuiWangSha,
    PartyGuiWangZong,
    PartyGunbreaker,
    PartyHealer,
    PartyHeHuanYing,
    PartyHeHuanYue,
    PartyHeHuanZong,
    PartyLingXiGe,
    PartyLingXiLing,
    PartyLingXiXi,
    PartyMachinist,
    PartyMagicRanged,
    PartyMelee,
    PartyMonk,
    PartyNinja,
    PartyPaladin,
    PartyPhysicalRanged,
    PartyPictomancer,
    PartyQingYunJian,
    PartyQingYunLei,
    PartyQingYunMen,
    PartyRanged,
    PartyReaper,
    PartyRedMage,
    PartySage,
    PartySamurai,
    PartyScholar,
    PartySummoner,
    PartySupport,
    PartyTank,
    PartyTianYinGe,
    PartyTianYinJing,
    PartyTianYinZhen,
    PartyViper,
    PartyWarrior,
    PartyWhiteMage,
} from '../prefabs/Party';
import {
    TetherClose,
    TetherFar,
    TetherLine,
    TetherMinusMinus,
    TetherPlusMinus,
    TetherPlusPlus,
} from '../prefabs/Tethers';
import { TextLabel } from '../prefabs/TextLabel';
import { ZoneArc } from '../prefabs/zone/ZoneArc';
import { ZoneCircle } from '../prefabs/zone/ZoneCircle';
import { ZoneCone } from '../prefabs/zone/ZoneCone';
import { ZoneDonut } from '../prefabs/zone/ZoneDonut';
import { ZoneExaflare } from '../prefabs/zone/ZoneExaflare';
import { ZoneEye } from '../prefabs/zone/ZoneEye';
import { ZoneKnockback } from '../prefabs/zone/ZoneKnockback';
import { ZoneLine } from '../prefabs/zone/ZoneLine';
import { ZoneLineKnockAway } from '../prefabs/zone/ZoneLineKnockAway';
import { ZoneLineKnockback } from '../prefabs/zone/ZoneLineKnockback';
import { ZoneLineStack } from '../prefabs/zone/ZoneLineStack';
import { ZonePolygon } from '../prefabs/zone/ZonePolygon';
import { ZoneProximity } from '../prefabs/zone/ZoneProximity';
import { ZoneRect } from '../prefabs/zone/ZoneRect';
import { ZoneRightTriangle } from '../prefabs/zone/ZoneRightTriangle';
import { ZoneRotateClockwise, ZoneRotateCounterClockwise } from '../prefabs/zone/ZoneRotate';
import { ZoneStack } from '../prefabs/zone/ZoneStack';
import { ZoneStarburst } from '../prefabs/zone/ZoneStarburst';
import { ZoneTower } from '../prefabs/zone/ZoneTower';
import { ZoneTriangle } from '../prefabs/zone/ZoneTriangle';
import { StatusJian } from '../prefabs/zxsj/StatusJian';
import { StatusJu } from '../prefabs/zxsj/StatusJu';
import { StatusShangDeath } from '../prefabs/zxsj/StatusShangDeath';
import {
    ZxsjWaymark1,
    ZxsjWaymark10,
    ZxsjWaymark2,
    ZxsjWaymark3,
    ZxsjWaymark4,
    ZxsjWaymark5,
    ZxsjWaymark6,
    ZxsjWaymark7,
    ZxsjWaymark8,
    ZxsjWaymark9,
} from '../prefabs/zxsj/WaymarksZXSJ';
import { ZoneProximityZXSJ } from '../prefabs/zxsj/ZoneProximityZXSJ';
import { ZoneTowerZXSJ } from '../prefabs/zxsj/ZoneTowerZXSJ';
import { useControlStyles } from '../useControlStyles';
import { ObjectGroup, Section } from './Section';

const ZonesAndWaymarksSection: React.FC<{ extraZones?: React.ReactNode; type: 'ff14' | 'zxsj' }> = ({
    extraZones,
    type,
}) => {
    const { t } = useTranslation();
    return (
        <>
            <Section title={t('prefabs.zones')}>
                <ObjectGroup>
                    <ZoneRightTriangle />
                    <ZoneTriangle />
                    <ZoneRect />
                    <ZoneLine />
                    <ZoneDonut />
                    <ZoneCircle />
                    <ZoneArc />
                    <ZoneCone />
                    <ZonePolygon />
                    <ZoneStarburst />
                </ObjectGroup>

                <ObjectGroup>
                    <ZoneKnockback />
                    {type === 'ff14' ? <ZoneProximity /> : <ZoneProximityZXSJ />}
                    <ZoneLineStack />
                    <ZoneStack />
                    <ZoneLineKnockback />
                    <ZoneLineKnockAway />
                    <ZoneExaflare />
                </ObjectGroup>

                <ObjectGroup>
                    {type === 'ff14' && <ZoneEye />}
                    {type === 'zxsj' && (
                        <>
                            <StatusShangDeath />
                            <StatusJu />
                            <StatusJian />
                        </>
                    )}
                    <ZoneRotateClockwise />
                    <ZoneRotateCounterClockwise />
                    {extraZones}
                </ObjectGroup>
            </Section>

            <Section title={t('prefabs.waymarks')}>
                <ObjectGroup>
                    <TextLabel />
                    <MarkerArrow />
                    {type === 'ff14' && (
                        <>
                            <WaymarkA />
                            <WaymarkB />
                            <WaymarkC />
                            <WaymarkD />
                        </>
                    )}
                </ObjectGroup>
                {type === 'ff14' && (
                    <ObjectGroup>
                        <Waymark1 />
                        <Waymark2 />
                        <Waymark3 />
                        <Waymark4 />
                    </ObjectGroup>
                )}
                {type === 'zxsj' && (
                    <>
                        <ObjectGroup>
                            <ZxsjWaymark1 />
                            <ZxsjWaymark2 />
                            <ZxsjWaymark3 />
                            <ZxsjWaymark4 />
                            <ZxsjWaymark5 />
                        </ObjectGroup>
                        <ObjectGroup>
                            <ZxsjWaymark6 />
                            <ZxsjWaymark7 />
                            <ZxsjWaymark8 />
                            <ZxsjWaymark9 />
                            <ZxsjWaymark10 />
                        </ObjectGroup>
                    </>
                )}
            </Section>
        </>
    );
};

const EnemiesAndTethersSection: React.FC<{ type: 'ff14' | 'zxsj' }> = ({ type }) => {
    const { t } = useTranslation();
    return (
        <>
            <Section title={t('prefabs.enemies')}>
                <ObjectGroup>
                    <EnemyCircle />
                    <EnemySmall />
                    <EnemyMedium />
                    <EnemyLarge />
                    <EnemyHuge />
                </ObjectGroup>
            </Section>

            <Section title={t('prefabs.tethers')}>
                <ObjectGroup>
                    <TetherLine />
                    <TetherClose />
                    <TetherFar />

                    {type === 'ff14' && (
                        <>
                            <TetherPlusMinus />
                            <TetherPlusPlus />
                            <TetherMinusMinus />
                        </>
                    )}
                </ObjectGroup>
                <Text block size={200} data-nosnippet>
                    {t('prefabs.tethersHelp.part1')} <HotkeyName keys="esc" /> {t('prefabs.tethersHelp.part2')}{' '}
                    <HotkeyName keys="ctrl" /> {t('prefabs.tethersHelp.part3')}
                </Text>
            </Section>
        </>
    );
};

export const PrefabsPanel: React.FC = () => {
    const controlClasses = useControlStyles();
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState<'ff14' | 'zxsj'>('ff14');

    return (
        <div className={controlClasses.panel}>
            <TabList
                selectedValue={selectedTab}
                onTabSelect={(_, data) => setSelectedTab(data.value as 'ff14' | 'zxsj')}
                style={{ marginBottom: '10px' }}
            >
                <Tab value="ff14">{t('prefabs.FF14')}</Tab>
                <Tab value="zxsj">{t('prefabs.ZXSJ')}</Tab>
            </TabList>

            {selectedTab === 'ff14' && (
                <>
                    <ZonesAndWaymarksSection type="ff14" extraZones={<ZoneTower />} />
                    <Section title={t('prefabs.party')}>
                        <ObjectGroup>
                            <PartySupport />
                            <PartyTank />
                            <PartyHealer />
                            <PartyDps />
                            <PartyAny />
                        </ObjectGroup>

                        <ObjectGroup>
                            <PartyMelee />
                            <PartyRanged />
                            <PartyMagicRanged />
                            <PartyPhysicalRanged />
                        </ObjectGroup>

                        <ObjectGroup>
                            <PartyPaladin />
                            <PartyWarrior />
                            <PartyDarkKnight />
                            <PartyGunbreaker />
                        </ObjectGroup>

                        <ObjectGroup>
                            <PartyWhiteMage />
                            <PartyScholar />
                            <PartyAstrologian />
                            <PartySage />
                        </ObjectGroup>

                        <ObjectGroup>
                            <PartyMonk />
                            <PartyDragoon />
                            <PartySamurai />
                            <PartyReaper />
                            <PartyNinja />
                            <PartyViper />
                        </ObjectGroup>

                        <ObjectGroup>
                            <PartyBlueMage />
                            <PartyBlackMage />
                            <PartySummoner />
                            <PartyRedMage />
                            <PartyPictomancer />
                        </ObjectGroup>

                        <ObjectGroup>
                            <PartyBard />
                            <PartyMachinist />
                            <PartyDancer />
                        </ObjectGroup>
                    </Section>
                    <EnemiesAndTethersSection type="zxsj" />
                </>
            )}

            {selectedTab === 'zxsj' && (
                <>
                    <ZonesAndWaymarksSection type="zxsj" extraZones={<ZoneTowerZXSJ />} />
                    <Section title={t('prefabs.party')}>
                        <ObjectGroup>
                            <PartyFenXiangGu />
                            <PartyGuiWangZong />
                            <PartyHeHuanZong />
                            <PartyLingXiGe />
                            <PartyQingYunMen />
                            <PartyTianYinGe />
                        </ObjectGroup>
                        <ObjectGroup>
                            <PartyFenXiangYan />
                            <PartyGuiWangSha />
                            <PartyHeHuanYing />
                            <PartyLingXiLing />
                            <PartyQingYunLei />
                            <PartyTianYinZhen />
                        </ObjectGroup>
                        <ObjectGroup>
                            <PartyFenXiangZhou />
                            <PartyGuiWangGang />
                            <PartyHeHuanYue />
                            <PartyLingXiXi />
                            <PartyQingYunJian />
                            <PartyTianYinJing />
                        </ObjectGroup>
                    </Section>
                    <EnemiesAndTethersSection type="zxsj" />
                </>
            )}
        </div>
    );
};
