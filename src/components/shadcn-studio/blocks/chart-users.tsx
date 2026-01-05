'use client'

import { ChevronUpIcon, EllipsisVerticalIcon, UsersIcon, UserPlusIcon } from 'lucide-react'

import { Bar, BarChart } from 'recharts'

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
  users: {
    label: 'Utilisateurs',
    color: 'var(--chart-5)'
  }
} satisfies ChartConfig

type Props = {
  className?: string
  chartData: { date: string; users: number }[]
  period: '7' | '30' | '90'
  onPeriodChange: (period: '7' | '30' | '90') => void
  totalUsers: number
  activeUsers: number
  percentChange: number
}

const UsersChartCard = ({ className, chartData, period, onPeriodChange, totalUsers, activeUsers, percentChange }: Props) => {
  const data = [
    {
      icon: <UsersIcon className='size-5' />,
      title: 'Total utilisateurs',
      status: 'Comptes créés',
      value: totalUsers.toString()
    },
    {
      icon: <UserPlusIcon className='size-5' />,
      title: 'Utilisateurs actifs',
      status: 'Avec workspace',
      value: activeUsers.toString()
    }
  ]

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className='flex justify-between'>
        <div className='flex flex-col gap-4'>
          <span className='text-lg font-semibold'>Utilisateurs actifs</span>
          <div className='flex items-center gap-3'>
            <span className='text-4xl font-semibold'>{totalUsers}</span>
            {percentChange !== 0 && (
              <div className='flex items-center gap-1'>
                <ChevronUpIcon className='size-4' />
                <span className='text-sm'>+{percentChange}%</span>
              </div>
            )}
          </div>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant={period === '7' ? 'default' : 'ghost'}
            size='sm'
            onClick={() => onPeriodChange('7')}
            className='text-xs h-8'
          >
            7j
          </Button>
          <Button
            variant={period === '30' ? 'default' : 'ghost'}
            size='sm'
            onClick={() => onPeriodChange('30')}
            className='text-xs h-8'
          >
            30j
          </Button>
          <Button
            variant={period === '90' ? 'default' : 'ghost'}
            size='sm'
            onClick={() => onPeriodChange('90')}
            className='text-xs h-8'
          >
            90j
          </Button>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col justify-between gap-4'>
        <ChartContainer config={chartConfig} className='min-h-37.5 w-full'>
          <BarChart
            data={chartData}
            margin={{
              right: 0,
              left: 0
            }}
            barSize={12}
          >
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey='users' fill='var(--color-users)' radius={[12, 12, 0, 0]} />
          </BarChart>
        </ChartContainer>

        <div className='space-y-4'>
          {data.map((item, index) => (
            <div key={index} className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-3'>
                <Avatar className='size-10 rounded-sm'>
                  <AvatarFallback className='bg-primary/10 text-primary shrink-0 rounded-sm'>
                    {item.icon}
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-lg font-medium'>{item.title}</span>
                  <span className='text-muted-foreground text-sm'>{item.status}</span>
                </div>
              </div>
              <span className='text-sm font-medium'>{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default UsersChartCard
