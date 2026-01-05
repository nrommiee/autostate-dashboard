'use client'

import { EllipsisVerticalIcon, ClipboardListIcon, CalendarIcon, TrendingUpIcon } from 'lucide-react'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { cn } from '@/lib/utils'

const listItems = ['Partager', 'Actualiser', 'Exporter']

const chartConfig = {
  missions: {
    label: 'Missions'
  }
} satisfies ChartConfig

type Props = {
  className?: string
  chartData: { date: string; missions: number }[]
  period: '7' | '30' | '90'
  onPeriodChange: (period: '7' | '30' | '90') => void
  stats: {
    thisMonth: number
    lastMonth: number
    total: number
  }
}

const MissionsChartCard = ({ className, chartData, period, onPeriodChange, stats }: Props) => {
  const ReportData = [
    {
      icon: <ClipboardListIcon className='text-chart-2 size-6 stroke-[1.5]' />,
      title: 'Ce mois',
      amount: stats.thisMonth.toString(),
      change: stats.thisMonth > stats.lastMonth ? `+${stats.thisMonth - stats.lastMonth}` : `${stats.thisMonth - stats.lastMonth}`
    },
    {
      icon: <CalendarIcon className='text-chart-1 size-6 stroke-[1.5]' />,
      title: 'Mois dernier',
      amount: stats.lastMonth.toString(),
      change: ''
    },
    {
      icon: <TrendingUpIcon className='text-chart-5 size-6 stroke-[1.5]' />,
      title: 'Total',
      amount: stats.total.toString(),
      change: ''
    }
  ]

  return (
    <Card className={cn('grid gap-6 py-0 lg:grid-cols-3', className)}>
      <div className='space-y-4 py-6 max-lg:border-b lg:col-span-2 lg:border-r'>
        <CardHeader className='flex justify-between'>
          <div className='flex flex-col gap-1'>
            <span className='text-lg font-semibold'>Missions réalisées</span>
            <span className='text-muted-foreground text-sm'>Évolution par jour</span>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant={period === '7' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => onPeriodChange('7')}
              className='text-xs h-8'
            >
              7 jours
            </Button>
            <Button
              variant={period === '30' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => onPeriodChange('30')}
              className='text-xs h-8'
            >
              30 jours
            </Button>
            <Button
              variant={period === '90' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => onPeriodChange('90')}
              className='text-xs h-8'
            >
              90 jours
            </Button>
          </div>
        </CardHeader>
        <CardContent className='pb-0'>
          <ChartContainer config={chartConfig} className='max-h-80 min-h-48 w-full max-[400px]:max-w-73'>
            <AreaChart
              data={chartData}
              margin={{
                left: -18,
                right: 12,
                top: 12,
                bottom: 12
              }}
              className='stroke-2'
            >
              <defs>
                <linearGradient id='fillMissions' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='20%' stopColor='var(--chart-2)' stopOpacity={1} />
                  <stop offset='80%' stopColor='var(--chart-2)' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray='3' stroke='var(--border)' vertical={false} />
              <XAxis
                dataKey='date'
                tickLine={false}
                tickMargin={5.5}
                axisLine={false}
                className='text-card-foreground text-sm uppercase opacity-100'
                fontSize={11}
              />
              <YAxis
                type='number'
                allowDataOverflow={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                tickMargin={8}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={value => [`${value}`, ' Missions']}
                  />
                }
              />
              <Area dataKey='missions' type='monotone' fill='url(#fillMissions)' stroke='var(--chart-2)' stackId='a' />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </div>
      <div className='flex flex-col gap-10 py-6'>
        <CardHeader className='flex justify-between'>
          <div className='flex flex-col gap-1'>
            <span className='text-lg font-semibold'>Rapport</span>
            <span className='text-muted-foreground text-sm'>Activité mensuelle</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full'>
                <EllipsisVerticalIcon />
                <span className='sr-only'>Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuGroup>
                {listItems.map((item, index) => (
                  <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className='grow lg:pl-0'>
          <div className='flex h-full flex-col gap-4'>
            {ReportData.map((report, index) => (
              <div key={index} className='bg-muted flex grow items-center justify-between gap-4 rounded-md px-4 py-2'>
                <div className='flex items-center gap-4'>
                  <Avatar className='size-10 rounded-sm'>
                    <AvatarFallback className='bg-card text-primary shrink-0 rounded-sm'>{report.icon}</AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col gap-0.5'>
                    <span className='text-muted-foreground font-medium'>{report.title}</span>
                    <span className='text-lg font-medium'>{report.amount}</span>
                  </div>
                </div>
                {report.change && <span className='text-sm'>{report.change}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

export default MissionsChartCard
