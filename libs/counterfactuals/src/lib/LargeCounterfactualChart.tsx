// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getTheme, DefaultButton, Stack } from "@fluentui/react";
import {
  AxisConfigDialog,
  ColumnCategories,
  ChartTypes,
  IGenericChartProps,
  ISelectorConfig,
  defaultModelAssessmentContext,
  ModelAssessmentContext,
  BasicHighChart,
  ITelemetryEvent,
  TelemetryEventName,
  JointDataset,
  TelemetryLevels,
  Cohort,
  ICounterfactualData,
  ifEnableLargeData,
  LoadingSpinner,
  IDataset
} from "@responsible-ai/core-ui";
import { localization } from "@responsible-ai/localization";
import _ from "lodash";
import React from "react";
import { calculateBubblePlotDataFromErrorCohort } from "../util/calculateBubbleData";
import { counterfactualChartStyles } from "./CounterfactualChart.styles";
import { CounterfactualPanel } from "./CounterfactualPanel";
import { getCounterfactualsScatterOption } from "./getCounterfactualsScatterOption";

export interface ICounterfactualChartProps {
  chartProps: IGenericChartProps;
  customPoints: Array<{ [key: string]: any }>;
  isPanelOpen: boolean;
  originalData?: { [key: string]: string | number };
  selectedPointsIndexes: number[];
  temporaryPoint: { [key: string]: any } | undefined;
  cohort: Cohort;
  jointDataset: JointDataset;
  dataset: IDataset;
  counterfactualData?: ICounterfactualData;
  isCounterfactualsDataLoading?: boolean;
  requestBubblePlotData?: (
    request: any,
    abortSignal: AbortSignal
  ) => Promise<any>;
  onChartPropsUpdated: (chartProps: IGenericChartProps) => void;
  saveAsPoint: () => void;
  setCustomRowProperty: (
    key: string | number,
    isString: boolean,
    newValue?: string | number | undefined
  ) => void;
  setCustomRowPropertyComboBox: (
    key: string | number,
    index?: number,
    value?: string
  ) => void;
  setTemporaryPointToCopyOfDatasetPoint: (
    index: number,
    absoluteIndex?: number
  ) => void;
  telemetryHook?: (message: ITelemetryEvent) => void;
  togglePanel: () => void;
  toggleSelectionOfPoint: (index?: number) => void;
  setCounterfactualData: (absoluteIndex: any) => Promise<void>;
  onIndexSeriesUpdated?: (data: any) => void;
}

export interface ICounterfactualChartState {
  xDialogOpen: boolean;
  yDialogOpen: boolean;
  plotData: any;
  x_series: number[];
  y_series: number[];
  index_series: number[];
  isBubbleChartDataLoading: boolean;
}

export class LargeCounterfactualChart extends React.PureComponent<
  ICounterfactualChartProps,
  ICounterfactualChartState
> {
  public static contextType = ModelAssessmentContext;
  public context: React.ContextType<typeof ModelAssessmentContext> =
    defaultModelAssessmentContext;
  private readonly chartAndConfigsId = "IndividualFeatureImportanceChart";

  public constructor(props: ICounterfactualChartProps) {
    super(props);

    this.state = {
      xDialogOpen: false,
      yDialogOpen: false,
      plotData: undefined,
      x_series: [],
      y_series: [],
      index_series: [],
      isBubbleChartDataLoading: false
    };
  }

  public componentDidMount(): void {
    this.loadPlotData();
  }

  public componentDidUpdate(prevProps: ICounterfactualChartProps): void {
    if (!_.isEqual(prevProps.chartProps, this.props.chartProps)) {
      this.updateBubblePlot();
    } else if (
      !_.isEqual(
        prevProps.selectedPointsIndexes,
        this.props.selectedPointsIndexes
      ) ||
      !_.isEqual(prevProps.customPoints, this.props.customPoints) ||
      !_.isEqual(
        prevProps.isCounterfactualsDataLoading,
        this.props.isCounterfactualsDataLoading
      )
    ) {
      this.updateScatterPlot();
    }
  }

  public render(): React.ReactNode {
    const classNames = counterfactualChartStyles();

    return (
      <Stack.Item className={classNames.chartWithAxes}>
        {this.props.originalData && (
          <CounterfactualPanel
            originalData={this.props.originalData}
            selectedIndex={this.props.selectedPointsIndexes[0] || 0}
            closePanel={this.props.togglePanel}
            saveAsPoint={this.props.saveAsPoint}
            setCustomRowProperty={this.props.setCustomRowProperty}
            setCustomRowPropertyComboBox={
              this.props.setCustomRowPropertyComboBox
            }
            temporaryPoint={this.props.temporaryPoint}
            isPanelOpen={this.props.isPanelOpen}
            data={this.context.counterfactualData}
            telemetryHook={this.props.telemetryHook}
          />
        )}
        {this.state.yDialogOpen && (
          <AxisConfigDialog
            orderedGroupTitles={[
              ColumnCategories.Index,
              ColumnCategories.Dataset,
              ColumnCategories.Outcome
            ]}
            selectedColumn={this.props.chartProps.yAxis}
            canBin={false}
            mustBin={false}
            allowTreatAsCategorical={!ifEnableLargeData(this.context.dataset)}
            canDither={this.props.chartProps.chartType === ChartTypes.Scatter}
            hideDroppedFeatures
            onAccept={this.onYSet}
            onCancel={this.setYClose}
          />
        )}
        {this.state.xDialogOpen && (
          <AxisConfigDialog
            orderedGroupTitles={[
              ColumnCategories.Index,
              ColumnCategories.Dataset,
              ColumnCategories.Outcome
            ]}
            selectedColumn={this.props.chartProps.xAxis}
            canBin={
              this.props.chartProps.chartType === ChartTypes.Histogram ||
              this.props.chartProps.chartType === ChartTypes.Box
            }
            mustBin={
              this.props.chartProps.chartType === ChartTypes.Histogram ||
              this.props.chartProps.chartType === ChartTypes.Box
            }
            canDither={this.props.chartProps.chartType === ChartTypes.Scatter}
            allowTreatAsCategorical={!ifEnableLargeData(this.context.dataset)}
            hideDroppedFeatures
            onAccept={this.onXSet}
            onCancel={this.setXClose}
          />
        )}
        <Stack horizontal={false}>
          <Stack.Item className={classNames.chartWithVertical}>
            <Stack horizontal id={this.chartAndConfigsId}>
              <Stack.Item className={classNames.verticalAxis}>
                <div className={classNames.rotatedVerticalBox}>
                  <DefaultButton
                    onClick={this.setYOpen}
                    text={
                      this.context.jointDataset.metaDict[
                        this.props.chartProps.yAxis.property
                      ].abbridgedLabel
                    }
                    title={
                      this.context.jointDataset.metaDict[
                        this.props.chartProps.yAxis.property
                      ].label
                    }
                    disabled={
                      this.props.isCounterfactualsDataLoading ||
                      this.state.isBubbleChartDataLoading
                    }
                  />
                </div>
              </Stack.Item>
              <Stack.Item className={classNames.mainChartContainer}>
                {this.state.isBubbleChartDataLoading ? (
                  <LoadingSpinner
                    label={localization.Counterfactuals.loading}
                  />
                ) : (
                  <BasicHighChart
                    configOverride={this.state.plotData}
                    theme={getTheme()}
                    id="CounterfactualChart"
                  />
                )}
              </Stack.Item>
            </Stack>
          </Stack.Item>
          <Stack className={classNames.horizontalAxisWithPadding}>
            <div className={classNames.horizontalAxis}>
              <DefaultButton
                onClick={this.setXOpen}
                text={
                  this.context.jointDataset.metaDict[
                    this.props.chartProps.xAxis.property
                  ].abbridgedLabel
                }
                title={
                  this.context.jointDataset.metaDict[
                    this.props.chartProps.xAxis.property
                  ].label
                }
                disabled={
                  this.props.isCounterfactualsDataLoading ||
                  this.state.isBubbleChartDataLoading
                }
              />
            </div>
          </Stack>
        </Stack>
      </Stack.Item>
    );
  }

  private onXSet = (value: ISelectorConfig): void => {
    if (!this.props.chartProps) {
      return;
    }
    const newProps = _.cloneDeep(this.props.chartProps);
    newProps.xAxis = value;
    this.setState({
      xDialogOpen: false,
      x_series: [],
      y_series: [],
      index_series: []
    });
    this.props.onChartPropsUpdated(newProps);
  };

  private onYSet = (value: ISelectorConfig): void => {
    if (!this.props.chartProps) {
      return;
    }
    const newProps = _.cloneDeep(this.props.chartProps);
    newProps.yAxis = value;
    this.setState({
      yDialogOpen: false,
      x_series: [],
      y_series: [],
      index_series: []
    });
    this.props.onChartPropsUpdated(newProps);
  };

  private readonly setXOpen = (): void => {
    this.setState({ xDialogOpen: !this.state.xDialogOpen });
  };

  private readonly setXClose = (): void => {
    this.setState({ xDialogOpen: false });
  };

  private readonly setYOpen = (): void => {
    this.setState({ yDialogOpen: !this.state.yDialogOpen });
  };

  private readonly setYClose = (): void => {
    this.setState({ yDialogOpen: false });
  };

  private async loadPlotData(): Promise<any> {
    this.setState({
      isBubbleChartDataLoading: true
    });
    const plotData = await calculateBubblePlotDataFromErrorCohort(
      this.props.cohort,
      this.props.chartProps,
      this.props.selectedPointsIndexes,
      this.props.customPoints,
      this.props.jointDataset,
      this.props.dataset,
      this.props.isCounterfactualsDataLoading,
      this.props.requestBubblePlotData,
      this.selectPointFromChartLargeData,
      this.onBubbleClick,
      this.props.onIndexSeriesUpdated
    );
    this.setState({
      plotData: plotData,
      isBubbleChartDataLoading: false
    });
  }

  private async updateBubblePlot(): Promise<any> {
    this.setState({
      isBubbleChartDataLoading: true
    });
    const plotData = await calculateBubblePlotDataFromErrorCohort(
      this.context.selectedErrorCohort.cohort,
      this.props.chartProps,
      this.props.selectedPointsIndexes,
      this.props.customPoints,
      this.context.jointDataset,
      this.props.dataset,
      this.props.isCounterfactualsDataLoading,
      this.context.requestBubblePlotData,
      this.selectPointFromChartLargeData,
      this.onBubbleClick,
      this.props.onIndexSeriesUpdated
    );
    this.setState({
      plotData: plotData,
      isBubbleChartDataLoading: false
    });
  }

  private updateScatterPlot(): void {
    const pData = getCounterfactualsScatterOption(
      this.state.x_series,
      this.state.y_series,
      this.state.index_series,
      this.props.chartProps,
      this.props.jointDataset,
      this.props.selectedPointsIndexes,
      this.props.customPoints,
      this.props.isCounterfactualsDataLoading,
      this.selectPointFromChartLargeData
    );

    this.setState({
      plotData: pData
    });
  }

  private readonly onBubbleClick = (
    scatterPlotData: any,
    x_series: number[],
    y_series: number[],
    index_series: number[]
  ): void => {
    this.setState({
      plotData: scatterPlotData,
      x_series: x_series,
      y_series: y_series,
      index_series: index_series
    });
  };

  private selectPointFromChartLargeData = async (data: any): Promise<void> => {
    const index = data.customData[JointDataset.IndexLabel];
    const absoluteIndex = data.customData[JointDataset.AbsoluteIndexLabel];
    this.props.setTemporaryPointToCopyOfDatasetPoint(index, absoluteIndex);
    this.props.setCounterfactualData(absoluteIndex);
    this.props.toggleSelectionOfPoint(index);
    this.logTelemetryEvent(
      TelemetryEventName.CounterfactualNewDatapointSelectedFromChart
    );
  };

  private logTelemetryEvent = (eventName: TelemetryEventName): void => {
    this.props.telemetryHook?.({
      level: TelemetryLevels.ButtonClick,
      type: eventName
    });
  };
}
